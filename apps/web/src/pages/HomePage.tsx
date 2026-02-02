import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

export default function HomePage() {
  return (
    <div className="container-page max-w-md mx-auto">
      <h1 className="text-center mb-8">Welcome to Splat Library</h1>
      <Authenticator>
        {({ user }) => (
          <div className="text-center">
            <p className="text-lg">Hello, {user?.signInDetails?.loginId}</p>
            <p className="mt-4 text-gray-600">
              You're signed in! Go to the Gallery to view scenes or Upload to create new ones.
            </p>
          </div>
        )}
      </Authenticator>
    </div>
  );
}
