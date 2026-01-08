/**
 * ================================================================
 * SOCIAL BACKEND RLS / RPC TEST SUITE
 * ================================================================
 *
 * Purpose:
 * --------
 * This file performs an end-to-end, adversarial test of the social
 * backend (follows, privacy, posts, likes, comments, blocks).
 *
 * All checks are executed as real authenticated users (A and B)
 * using the Supabase anon key. No service role or admin bypasses
 * are used — this validates true production behaviour.
 *
 * The goal is to ensure:
 *  - Correct follow/request state transitions
 *  - No privacy leaks via posts, likes, or comments
 *  - No spoofing, deletion, or update attacks
 *  - Blocks override all other relationships
 *  - RLS is the final source of truth (frontend cannot bypass)
 *
 * ------------------------------------------------
 * TEST INDEX
 * ------------------------------------------------
 *
 * [T01] Public follow
 *       B follows A when A is public → follow row created
 *
 * [T02] Idempotent follow
 *       Repeated follow calls do not create duplicates
 *
 * [T03] Unfollow
 *       B unfollows A → follow row removed
 *
 * [T04] Private follow request
 *       A private → B request_follow(A) creates pending request
 *
 * [T05] Cancel request
 *       B cancels pending follow request
 *
 * [T06] Re-request after cancel
 *       Cancelled request can be re-created as pending
 *
 * [T07] Reject then re-request
 *       A rejects → B can re-request and return to pending
 *
 * [T08] Accept request
 *       A accepts → follow row created, request marked accepted
 *
 * [T09] Post-accept idempotency
 *       request_follow after accept returns "following"
 *
 * ------------------------------------------------
 * CONTENT VISIBILITY
 * ------------------------------------------------
 *
 * [T10] Followers post visibility
 *       Followers-only post readable by follower
 *
 * [T11] Like gating
 *       Likes allowed only when post is visible
 *
 * [T12] Private account public-post prevention
 *       Private users cannot create public posts
 *
 * [T13] Private account read protection
 *       Non-followers cannot read followers-only posts
 *
 * [T14] Oracle protection
 *       Likes/comments cannot be used to infer hidden posts
 *
 * ------------------------------------------------
 * ATTACK PREVENTION
 * ------------------------------------------------
 *
 * [T15] user_id spoofing
 *       B cannot create a post pretending to be A
 *
 * [T16] Delete protection
 *       B cannot delete A’s post
 *
 * [T17] Comment write protection
 *       B cannot comment on hidden posts
 *
 * [T18] Comment read protection
 *       B cannot read comments for hidden posts
 *
 * [T19] Like idempotency
 *       Double-like results in exactly one like row
 *
 * [T20] Update protection
 *       B cannot update A’s post
 *
 * ------------------------------------------------
 * BLOCK BEHAVIOUR
 * ------------------------------------------------
 *
 * [T21] Block after follow
 *       A blocks B → B immediately loses access
 *
 * [T22] Privacy flip safety
 *       A goes private after B follows → B retains follower access
 *
 * [T23] Block overrides
 *       Block prevents follow + hides all content
 *
 * [T24] Reverse block
 *       If B blocks A, A cannot follow B
 *
 * ------------------------------------------------
 * EXPECTED RESULT
 * ------------------------------------------------
 *
 * All tests must pass (24/24).
 * Any failure indicates a real security or logic regression and
 * should be fixed at the database/RLS level — not in frontend code.
 *
 * ================================================================
 */


/* scripts/social-backend-test.js */
const { createClient } = require("@supabase/supabase-js");

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  A_EMAIL,
  A_PASSWORD,
  B_EMAIL,
  B_PASSWORD,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}
if (!A_EMAIL || !A_PASSWORD || !B_EMAIL || !B_PASSWORD) {
  throw new Error("Missing A/B email/password env vars");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login(label, email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`[${label}] ${error.message}`);

  const id = data?.session?.user?.id;
  assert(id, `[${label}] No user id after login`);

  console.log(`[${label}] logged in as user_id=${id}`);
  return { client, userId: id };
}

/** RPC helpers (never chain .catch on rpc result) */
async function rpcRequired(client, name, params) {
  const { data, error } = await client.rpc(name, params);
  if (error) throw error;
  return data;
}
async function rpcBestEffort(client, name, params) {
  const { error } = await client.rpc(name, params);
  return !error;
}

async function ensureProfileRow(client, userId, label) {
  const { data, error } = await client
    .from("profiles")
    .select("id,is_private")
    .eq("id", userId)
    .maybeSingle();

  if (error)
    throw new Error(`[${label}] profiles select failed: ${error.message}`);
  if (!data) {
    throw new Error(
      `[${label}] No public.profiles row for user_id=${userId}. ` +
        `Create it (trigger/onboarding) or insert one-time for test users.`
    );
  }
}

async function setPrivateFlag(client, userId, isPrivate) {
  const { error } = await client
    .from("profiles")
    .update({ is_private: isPrivate })
    .eq("id", userId);
  if (error) throw error;

  const { data, error: e2 } = await client
    .from("profiles")
    .select("is_private")
    .eq("id", userId)
    .single();
  if (e2) throw e2;

  assert(
    data.is_private === isPrivate,
    `profiles.is_private did not update for ${userId} (wanted ${isPrivate}, got ${data.is_private})`
  );
}

async function hardReset(A, B) {
  const A_ID = A.userId;
  const B_ID = B.userId;

  // Clear blocks both directions
  await A.client
    .from("user_blocks")
    .delete()
    .eq("blocker_id", A_ID)
    .eq("blocked_id", B_ID);
  await B.client
    .from("user_blocks")
    .delete()
    .eq("blocker_id", B_ID)
    .eq("blocked_id", A_ID);

  // Clear follows both directions
  await A.client
    .from("user_follows")
    .delete()
    .eq("follower_id", A_ID)
    .eq("followee_id", B_ID);
  await B.client
    .from("user_follows")
    .delete()
    .eq("follower_id", B_ID)
    .eq("followee_id", A_ID);

  // Cancel pending requests both directions (best-effort)
  await rpcBestEffort(A.client, "cancel_follow_request", { p_target: B_ID });
  await rpcBestEffort(B.client, "cancel_follow_request", { p_target: A_ID });

  // Set both public
  await setPrivateFlag(A.client, A_ID, false);
  await setPrivateFlag(B.client, B_ID, false);

  // Delete own likes/comments/posts
  await A.client.from("post_likes").delete().eq("user_id", A_ID);
  await B.client.from("post_likes").delete().eq("user_id", B_ID);

  await A.client.from("post_comments").delete().eq("user_id", A_ID);
  await B.client.from("post_comments").delete().eq("user_id", B_ID);

  await A.client.from("posts").delete().eq("user_id", A_ID);
  await B.client.from("posts").delete().eq("user_id", B_ID);

  // Reset privacy again
  await setPrivateFlag(A.client, A_ID, false);
  await setPrivateFlag(B.client, B_ID, false);
}

function buildCommentRow({ postId, userId, body = "secret comment" }) {
  // ✅ your schema: body is NOT NULL
  return { post_id: postId, user_id: userId, body };
}

async function run() {
  console.log("Logging in as A and B...");
  const A = await login("A", A_EMAIL, A_PASSWORD);
  const B = await login("B", B_EMAIL, B_PASSWORD);

  await ensureProfileRow(A.client, A.userId, "A");
  await ensureProfileRow(B.client, B.userId, "B");

  console.log("Hard reset state...");
  await hardReset(A, B);

  const A_ID = A.userId;
  const B_ID = B.userId;

  const results = [];
  let t = 0;

  async function test(name, fn) {
    const label = `[T${String(++t).padStart(2, "0")}] ${name}`;
    try {
      await fn();
      results.push({ name: label, ok: true });
      console.log("✅", label);
    } catch (e) {
      results.push({ name: label, ok: false, err: e });
      console.error("❌", label, "\n   ", e?.message || e);
    }
  }

  // ---------------- Core follow/request flow ----------------

  await test("Public follow: B request_follow(A) => following + row exists", async () => {
    const data = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(data === "following", `expected 'following', got ${data}`);

    const { data: rows, error } = await B.client
      .from("user_follows")
      .select("*")
      .eq("follower_id", B_ID)
      .eq("followee_id", A_ID);
    if (error) throw error;
    assert(rows.length === 1, `expected 1 follow row, got ${rows.length}`);
  });

  await test("Idempotent follow: calling again stays following + no dupes", async () => {
    const data = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(data === "following", `expected 'following', got ${data}`);

    const { data: rows, error } = await B.client
      .from("user_follows")
      .select("*")
      .eq("follower_id", B_ID)
      .eq("followee_id", A_ID);
    if (error) throw error;
    assert(
      rows.length === 1,
      `expected still 1 follow row, got ${rows.length}`
    );
  });

  await test("Unfollow: B unfollow(A) removes row", async () => {
    await rpcRequired(B.client, "unfollow", { p_target: A_ID });

    const { data: rows, error } = await B.client
      .from("user_follows")
      .select("*")
      .eq("follower_id", B_ID)
      .eq("followee_id", A_ID);
    if (error) throw error;
    assert(rows.length === 0, `expected 0 follow rows, got ${rows.length}`);
  });

  await test("Private request: A private, B request_follow(A) => requested + pending row", async () => {
    await setPrivateFlag(A.client, A_ID, true);

    const data = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(data === "requested", `expected 'requested', got ${data}`);

    const { data: rows, error } = await B.client
      .from("follow_requests")
      .select("status")
      .eq("requester_id", B_ID)
      .eq("target_id", A_ID);
    if (error) throw error;

    assert(rows.length === 1, `expected 1 request row, got ${rows.length}`);
    assert(
      rows[0].status === "pending",
      `expected pending, got ${rows[0].status}`
    );
  });

  await test("Cancel request: B cancel_follow_request(A) => cancelled", async () => {
    await rpcRequired(B.client, "cancel_follow_request", { p_target: A_ID });

    const { data: row, error } = await B.client
      .from("follow_requests")
      .select("status")
      .eq("requester_id", B_ID)
      .eq("target_id", A_ID)
      .maybeSingle();
    if (error) throw error;

    assert(
      row?.status === "cancelled",
      `expected cancelled, got ${row?.status}`
    );
  });

  await test("Re-request after cancel: B request_follow(A) => requested + pending", async () => {
    const data = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(data === "requested", `expected requested, got ${data}`);

    const { data: row, error } = await B.client
      .from("follow_requests")
      .select("status")
      .eq("requester_id", B_ID)
      .eq("target_id", A_ID)
      .single();
    if (error) throw error;

    assert(row.status === "pending", `expected pending, got ${row.status}`);
  });

  await test("Reject then re-request: A rejects, B re-requests => pending again", async () => {
    await rpcRequired(A.client, "reject_follow_request", { p_requester: B_ID });

    const data = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(data === "requested", `expected requested, got ${data}`);

    const { data: row, error } = await B.client
      .from("follow_requests")
      .select("status")
      .eq("requester_id", B_ID)
      .eq("target_id", A_ID)
      .single();
    if (error) throw error;

    assert(row.status === "pending", `expected pending, got ${row.status}`);
  });

  await test("Accept request: A accept_follow_request(B) => accepted + follow row", async () => {
    await rpcRequired(A.client, "accept_follow_request", { p_requester: B_ID });

    const { data: fRows, error: e2 } = await B.client
      .from("user_follows")
      .select("*")
      .eq("follower_id", B_ID)
      .eq("followee_id", A_ID);
    if (e2) throw e2;
    assert(
      fRows.length === 1,
      `expected follow row after accept, got ${fRows.length}`
    );

    const { data: rRow, error: e3 } = await B.client
      .from("follow_requests")
      .select("status")
      .eq("requester_id", B_ID)
      .eq("target_id", A_ID)
      .maybeSingle();
    if (e3) throw e3;

    assert(
      rRow?.status === "accepted",
      `expected accepted, got ${rRow?.status}`
    );
  });

  await test("After accepted: B request_follow(A) => following", async () => {
    const data = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(data === "following", `expected 'following', got ${data}`);
  });

  // ---------------- Posts visibility + attacks ----------------

  await test("Followers post readable by follower", async () => {
    const { data: post, error } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "followers only",
        },
      ])
      .select()
      .single();
    if (error) throw error;

    const { data: read, error: e2 } = await B.client
      .from("posts")
      .select("*")
      .eq("id", post.id);
    if (e2) throw e2;
    assert(read.length === 1, "B should read followers post as follower");
  });

  await test("Like allowed when post is visible", async () => {
    const { data: posts, error } = await B.client
      .from("posts")
      .select("id")
      .eq("user_id", A_ID)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    assert(posts.length === 1, "Expected at least 1 post from A");
    const postId = posts[0].id;

    const first = await B.client
      .from("post_likes")
      .insert([{ post_id: postId, user_id: B_ID }]);
    if (first.error) throw first.error;

    const { data: liked, error: e3 } = await B.client
      .from("post_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", B_ID);
    if (e3) throw e3;
    assert(liked.length === 1, "Like row should exist");
  });

  await test("Private account cannot create PUBLIC post (should fail)", async () => {
    await setPrivateFlag(A.client, A_ID, true);

    const { error } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "public",
          caption: "should not be allowed",
        },
      ]);
    assert(error, "Expected insert to fail, but it succeeded");
  });

  await test("Non-follower cannot read private user's followers post", async () => {
    await setPrivateFlag(A.client, A_ID, true);
    await rpcBestEffort(B.client, "unfollow", { p_target: A_ID });

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "private acct post",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    const { data: read, error: e2 } = await B.client
      .from("posts")
      .select("*")
      .eq("id", post.id);
    if (e2) throw e2;
    assert(read.length === 0, `Expected 0 rows, got ${read.length}`);
  });

  await test("Oracle protection: cannot like/read likes for hidden post", async () => {
    const { data: posts, error: e0 } = await A.client
      .from("posts")
      .select("id")
      .eq("user_id", A_ID)
      .order("created_at", { ascending: false })
      .limit(1);
    if (e0) throw e0;
    assert(posts.length === 1, "Expected at least 1 recent post from A");
    const hiddenPostId = posts[0].id;

    const { error: e1 } = await B.client
      .from("post_likes")
      .insert([{ post_id: hiddenPostId, user_id: B_ID }]);
    assert(e1, "Expected like insert to fail for hidden post");

    const { data: likes, error: e2 } = await B.client
      .from("post_likes")
      .select("*")
      .eq("post_id", hiddenPostId);
    if (e2) throw e2;
    assert(likes.length === 0, `Expected 0 likes visible, got ${likes.length}`);
  });

  await test("Spoofing user_id: B cannot create post as A", async () => {
    const { error } = await B.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "I am not A",
        },
      ]);
    assert(error, "Expected insert to fail, but it succeeded");
  });

  await test("Delete protection: B cannot delete A post (post remains)", async () => {
    await setPrivateFlag(A.client, A_ID, false);

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "delete me test",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    const { data: ownerRow, error: eo } = await A.client
      .from("posts")
      .select("id,user_id")
      .eq("id", post.id)
      .single();
    if (eo) throw eo;
    console.log("   DEBUG post owner:", ownerRow);

    // RLS deletes often return success with 0 rows; verify by reading as owner
    const { error: delErr } = await B.client
      .from("posts")
      .delete()
      .eq("id", post.id);
    if (delErr) throw delErr;

    const { data: stillThere, error: e3 } = await A.client
      .from("posts")
      .select("id")
      .eq("id", post.id);
    if (e3) throw e3;
    assert(
      stillThere.length === 1,
      "Post was deleted by non-owner (security bug)"
    );
  });

  // ---------------- NEW: Comments + update + block timing + privacy timing ----------------

  await test("NEW: B cannot comment on hidden post (A private + followers post, B not follower)", async () => {
    await setPrivateFlag(A.client, A_ID, true);
    await rpcBestEffort(B.client, "unfollow", { p_target: A_ID });

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "hidden from B for comment test",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    const { error: e2 } = await B.client
      .from("post_comments")
      .insert([
        buildCommentRow({ postId: post.id, userId: B_ID, body: "should fail" }),
      ]);
    assert(e2, "Expected comment insert to fail for hidden post");
  });

  await test("NEW: B cannot read comments for hidden post", async () => {
    await setPrivateFlag(A.client, A_ID, true);
    await rpcBestEffort(B.client, "unfollow", { p_target: A_ID });

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "hidden comment read test",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    const { error: e2 } = await A.client
      .from("post_comments")
      .insert([
        buildCommentRow({
          postId: post.id,
          userId: A_ID,
          body: "secret A comment",
        }),
      ]);
    if (e2) throw e2;

    const { data: comments, error: e3 } = await B.client
      .from("post_comments")
      .select("*")
      .eq("post_id", post.id);
    if (e3) throw e3;

    assert(
      comments.length === 0,
      `Expected 0 comments visible, got ${comments.length}`
    );
  });

  await test("NEW: Double-like idempotency: liking twice yields 1 row", async () => {
    await setPrivateFlag(A.client, A_ID, false);
    await rpcBestEffort(B.client, "request_follow", { p_target: A_ID });

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "double-like test",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    const first = await B.client
      .from("post_likes")
      .insert([{ post_id: post.id, user_id: B_ID }]);
    if (first.error) throw first.error;

    // second insert may error due to unique constraint; that's fine
    await B.client
      .from("post_likes")
      .insert([{ post_id: post.id, user_id: B_ID }]);

    const { data: liked, error: e3 } = await B.client
      .from("post_likes")
      .select("*")
      .eq("post_id", post.id)
      .eq("user_id", B_ID);
    if (e3) throw e3;

    assert(
      liked.length === 1,
      `Expected exactly 1 like row, got ${liked.length}`
    );
  });

  await test("NEW: B cannot update A post", async () => {
    await setPrivateFlag(A.client, A_ID, false);
    await rpcBestEffort(B.client, "request_follow", { p_target: A_ID });

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "original caption",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    // B attempts update (may be blocked or 0 rows)
    await B.client
      .from("posts")
      .update({ caption: "HACKED" })
      .eq("id", post.id);

    // Verify unchanged as A
    const { data: row, error: e3 } = await A.client
      .from("posts")
      .select("caption")
      .eq("id", post.id)
      .single();
    if (e3) throw e3;

    assert(
      row.caption === "original caption",
      `Caption changed unexpectedly: ${row.caption}`
    );
  });

  await test("NEW: A blocks B after follow => B loses access immediately", async () => {
    await setPrivateFlag(A.client, A_ID, false);
    await rpcBestEffort(B.client, "request_follow", { p_target: A_ID });

    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "block-after-follow test",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    const { data: pre, error: e2 } = await B.client
      .from("posts")
      .select("id")
      .eq("id", post.id);
    if (e2) throw e2;
    assert(pre.length === 1, "B should see post before block");

    await rpcRequired(A.client, "block_user", { p_target: B_ID });

    const { data: postRows, error: e4 } = await B.client
      .from("posts")
      .select("id")
      .eq("id", post.id);
    if (e4) throw e4;
    assert(
      postRows.length === 0,
      `Expected 0 visible posts after block, got ${postRows.length}`
    );
  });

  await test("NEW: A goes private after B already follows => B still sees followers posts", async () => {
    // Ensure clean state from previous tests (T21 may have blocked)
    await A.client
      .from("user_blocks")
      .delete()
      .eq("blocker_id", A_ID)
      .eq("blocked_id", B_ID);
    await B.client
      .from("user_blocks")
      .delete()
      .eq("blocker_id", B_ID)
      .eq("blocked_id", A_ID);

    // Ensure A is public so follow is immediate
    await setPrivateFlag(A.client, A_ID, false);

    // Make sure B follows A (DO NOT swallow errors here)
    const followStatus = await rpcRequired(B.client, "request_follow", {
      p_target: A_ID,
    });
    assert(
      followStatus === "following",
      `expected following, got ${followStatus}`
    );

    // Sanity: follow row exists
    const { data: followRows, error: fe } = await B.client
      .from("user_follows")
      .select("*")
      .eq("follower_id", B_ID)
      .eq("followee_id", A_ID);
    if (fe) throw fe;
    assert(
      followRows.length === 1,
      `Expected follow row, got ${followRows.length}`
    );

    // Flip privacy AFTER follow exists
    await setPrivateFlag(A.client, A_ID, true);

    // Create followers-only post (allowed for private accounts)
    const { data: post, error: e1 } = await A.client
      .from("posts")
      .insert([
        {
          user_id: A_ID,
          post_type: "text",
          visibility: "followers",
          caption: "still visible to existing follower",
        },
      ])
      .select()
      .single();
    if (e1) throw e1;

    // Existing follower should still read it
    const { data: read, error: e2 } = await B.client
      .from("posts")
      .select("id")
      .eq("id", post.id);
    if (e2) throw e2;
    assert(
      read.length === 1,
      "Existing follower should still read followers post after privacy flip"
    );
  });

  // ---------------- Block behavior ----------------

  await test("Block overrides: A blocks B => B cannot follow or read A posts", async () => {
    await setPrivateFlag(A.client, A_ID, false);

    await rpcRequired(A.client, "block_user", { p_target: B_ID });

    const { data, error } = await B.client.rpc("request_follow", {
      p_target: A_ID,
    });
    assert(error, "Expected request_follow to fail due to block");
    assert(!data, "Expected no data on blocked follow request");

    const { data: read, error: e2 } = await B.client
      .from("posts")
      .select("*")
      .eq("user_id", A_ID);
    if (e2) throw e2;
    assert(
      read.length === 0,
      `Expected 0 posts visible after block, got ${read.length}`
    );
  });

  await test("Reverse block: if B blocks A, A cannot follow B", async () => {
    await A.client
      .from("user_blocks")
      .delete()
      .eq("blocker_id", A_ID)
      .eq("blocked_id", B_ID);
    await B.client
      .from("user_blocks")
      .delete()
      .eq("blocker_id", B_ID)
      .eq("blocked_id", A_ID);

    await rpcRequired(B.client, "block_user", { p_target: A_ID });

    const { data, error } = await A.client.rpc("request_follow", {
      p_target: B_ID,
    });
    assert(error, "Expected request_follow to fail due to reverse block");
    assert(!data, "Expected no data on blocked follow attempt");
  });

  // Summary
  const failed = results.filter((r) => !r.ok);
  console.log("\n--- SUMMARY ---");
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
