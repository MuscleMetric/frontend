/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load native components in isolation. */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import CreatePostFlow from '@/app/features/social/create';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }));
jest.mock('@/ui', () => {
  const { Text, Pressable } = require('react-native');
  return { LoadingScreen: () => <Text>Loading</Text>, ErrorState: ({ title, onRetry }: any) => <Pressable onPress={onRetry}><Text>{title}</Text></Pressable> };
});
jest.mock('@/ui/buttons/Button', () => {
  const { Text, Pressable } = require('react-native');
  return { Button: ({ title, onPress }: any) => <Pressable onPress={onPress}><Text>{title}</Text></Pressable> };
});
jest.mock('@/app/features/social/create/entry/CreatePostSheet', () => () => null);
jest.mock('@/app/features/social/create/selectWorkout/SelectWorkoutScreen', () => function MockSelectWorkout() { const { Text } = require('react-native'); return <Text>Select workout</Text>; });
jest.mock('@/app/features/social/create/editPrPost/EditPrPostScreen', () => () => null);
jest.mock('@/app/features/social/create/success/PostSuccessSheet', () => () => null);
jest.mock('@/app/features/social/create/editWorkoutPost/EditWorkoutPostScreen', () => {
  const { Text, Pressable, View } = require('react-native');
  return function MockWorkoutEditor({ workout, onBack, onPost }: any) { return <View><Text>{workout.title}</Text><Text>{workout.workoutHistoryId}</Text><Pressable onPress={onBack}><Text>Cancel post</Text></Pressable><Pressable onPress={onPost}><Text>Post</Text></Pressable></View>; };
});
const replace = jest.fn();
beforeEach(() => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ type: 'workout', workoutHistoryId: 'saved-session', source: 'workout_complete' });
  (useRouter as jest.Mock).mockReturnValue({ replace });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: { workout_history_id: 'saved-session', title: 'Lower A', exercises: [] }, error: null });
});
it('opens the exact saved session directly without publishing or workout selection', async () => {
  const screen = render(<CreatePostFlow />);
  await screen.findByText('Lower A');
  expect(screen.getByText('saved-session')).toBeTruthy();
  expect(screen.queryByText('Select workout')).toBeNull();
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).toHaveBeenCalledWith('get_workout_for_post_v1', { p_workout_history_id: 'saved-session' });
  fireEvent.press(screen.getByText('Cancel post'));
  expect(replace).toHaveBeenCalledWith('/');
});
it('offers retry and an exit if the saved session cannot load', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'Offline' } });
  const screen = render(<CreatePostFlow />);
  await screen.findByText('Your workout is saved');
  expect(screen.getByText('Back to home')).toBeTruthy();
  fireEvent.press(screen.getByText('Your workout is saved'));
  await screen.findByText('Lower A');
});
it('publishes only after the user taps Post, using the saved session ID', async () => {
  const screen = render(<CreatePostFlow />);
  await screen.findByText('Lower A');
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: 'new-post', error: null });
  await act(async () => { fireEvent.press(screen.getByText('Post')); });
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('create_post_v2', expect.objectContaining({ p_workout_history_id: 'saved-session', p_post_type: 'workout' })));
});
