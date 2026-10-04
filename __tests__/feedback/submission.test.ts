import { submitFeedback } from '@/features/feedback/data/feedback.mutations';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getUser: jest.fn() }, from: jest.fn() } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.4' } } }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.6' }));
jest.mock('expo-device', () => ({ osVersion: '18.0', modelName: 'iPhone' }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', Version: '18.0' } }));

const insert = jest.fn();
beforeEach(() => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  (supabase.from as jest.Mock).mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
});

it.each([
  { type: 'issue' as const, category: 'other', message: ' Broken ', additionalContext: ' Expected ' },
  { type: 'improvement' as const, category: 'social', message: ' Suggestion ' },
  { type: 'rating' as const, rating: 5, ratingTags: ['easy_to_use'], message: '' },
])('submits $type with ownership and installed version', async input => {
  await submitFeedback(input);
  expect(supabase.from).toHaveBeenCalledWith('app_feedback');
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: 'user-1', feedback_type: input.type, app_version: '1.0.6', platform: 'ios',
    message: input.message.trim() || null,
  }));
});

it('rejects signed-out submissions before writing', async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
  await expect(submitFeedback({ type: 'rating', rating: 5 })).rejects.toThrow('signed in');
  expect(insert).not.toHaveBeenCalled();
});

it('propagates failed inserts so the form can offer a retry', async () => {
  insert.mockResolvedValue({ error: new Error('Network unavailable') });
  await expect(submitFeedback({ type: 'rating', rating: 5 })).rejects.toThrow('Network unavailable');
});
