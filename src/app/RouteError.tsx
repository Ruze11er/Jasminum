import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { Compass, HeartCrack } from 'lucide-react';
import { Button, EmptyState } from '@/design-system';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="This page doesn't exist. Your data is safe."
      action={<Button onClick={() => navigate('/')}>Go home</Button>}
    />
  );
}

/** Shown if a page crashes. User data lives in the database, so reloading is always safe. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <EmptyState
        icon={<HeartCrack />}
        title="Something went wrong"
        description="Your data is safe. Reloading usually fixes this."
        action={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
      <p className="sr-only">{message}</p>
    </div>
  );
}
