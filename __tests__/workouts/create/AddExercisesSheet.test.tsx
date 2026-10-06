/* eslint-disable @typescript-eslint/no-require-imports -- Native UI stubs for the picker regression. */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddExercisesSheet from '@/app/features/workouts/create/modals/AddExercisesSheet';
import { fetchExercises } from '@/app/features/workouts/create/data/exercises.query';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/app/features/workouts/create/data/exercises.query', () => ({ fetchExercises: jest.fn() }));
jest.mock('@/lib/useAppTheme', () => ({ useAppTheme: () => ({ colors: {}, typography: { fontFamily: {}, size: {}, lineHeight: {} }, layout: { space: {}, radius: {} } }) }));
jest.mock('@/ui', () => {
  const { Text } = require('react-native');
  return { Pill: ({ label }: { label: string }) => <Text>{label}</Text>, Icon: () => null };
});

const bench = { id: 'bench', name: 'Bench Press' };
const squat = { id: 'squat', name: 'Squat' };
beforeEach(() => {
  (fetchExercises as jest.Mock).mockImplementation(async ({ filters }) => filters.query === 'squat' ? [squat] : [bench, squat]);
});
it('keeps every selection across searches and submits in tap order', async () => {
  const onDone = jest.fn();
  const screen = render(<AddExercisesSheet visible userId="test" selectedIds={[]} onClose={jest.fn()} onDone={onDone} />);
  fireEvent.press(await screen.findByText('Bench Press'));
  fireEvent.changeText(screen.getByPlaceholderText('Search exercises...'), 'squat');
  await waitFor(() => expect(screen.queryByText('Bench Press')).toBeNull());
  fireEvent.press(screen.getByText('Squat'));
  fireEvent.press(screen.getByText('Add (2)'));
  expect(onDone).toHaveBeenCalledWith([{ exerciseId: 'bench', name: 'Bench Press' }, { exerciseId: 'squat', name: 'Squat' }]);
});
it('uses selection order rather than catalog order and excludes existing exercises', async () => {
  const onDone = jest.fn();
  const screen = render(<AddExercisesSheet visible userId="test" selectedIds={[]} onClose={jest.fn()} onDone={onDone} />);
  fireEvent.press(await screen.findByText('Squat'));
  fireEvent.press(screen.getByText('Bench Press'));
  fireEvent.press(screen.getByText('Add (2)'));
  expect(onDone).toHaveBeenCalledWith([{ exerciseId: 'squat', name: 'Squat' }, { exerciseId: 'bench', name: 'Bench Press' }]);
  screen.unmount();
  const locked = render(<AddExercisesSheet visible userId="test" selectedIds={['bench']} onClose={jest.fn()} onDone={onDone} />);
  fireEvent.press(await locked.findByText('Bench Press'));
  fireEvent.press(locked.getByText('Squat'));
  fireEvent.press(locked.getByText('Add (1)'));
  expect(onDone).toHaveBeenLastCalledWith([{ exerciseId: 'squat', name: 'Squat' }]);
});
