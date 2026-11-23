import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="text-blue-700 underline">
        Back to dashboard
      </Link>
    </div>
  );
}
