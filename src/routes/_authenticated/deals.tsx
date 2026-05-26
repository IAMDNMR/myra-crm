import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/deals')({
  beforeLoad: () => {
    throw redirect({ to: '/pipeline/list' });
  },
  component: () => null,
});
