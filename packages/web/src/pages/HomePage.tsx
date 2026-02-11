import { Authenticator } from '@aws-amplify/ui-react';
import { Link } from 'react-router-dom';
import '@aws-amplify/ui-react/styles.css';

export default function HomePage() {
  return (
    <div className="container-page">
      {/* Hero Section */}
      <section className="text-center py-16 md:py-24">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-overlay border border-surface-border text-sm text-text-secondary animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-accent-green" />
            Now with GPU-accelerated processing
          </div>
          
          <h1 className="text-gradient animate-fade-up opacity-0 stagger-1">
            Transform Videos into<br />3D Gaussian Splats
          </h1>
          
          <p className="text-lg text-text-secondary max-w-xl mx-auto animate-fade-up opacity-0 stagger-2">
            Upload your video footage and let our pipeline automatically generate 
            photorealistic 3D scenes using state-of-the-art gaussian splatting.
          </p>
          
          <div className="flex justify-center gap-4 pt-4 animate-fade-up opacity-0 stagger-3">
            <Link to="/gallery" className="btn btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Browse Gallery
            </Link>
          </div>
        </div>
      </section>

      <div className="glow-line my-8" />

      {/* Auth Section */}
      <section className="max-w-md mx-auto py-8 animate-fade-up opacity-0 stagger-4">
        <Authenticator hideSignUp>
          {({ user }) => (
            <div className="card-glow p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-text-secondary text-sm">Signed in as</p>
                <p className="font-mono text-accent-cyan">{user?.signInDetails?.loginId}</p>
              </div>
              <Link to="/upload" className="btn btn-primary w-full">
                Start Creating
              </Link>
            </div>
          )}
        </Authenticator>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '⚡', title: 'Fast Processing', desc: 'GPU-accelerated pipeline with AWS Batch', color: 'accent-yellow' },
            { icon: '🎯', title: 'High Quality', desc: 'State-of-the-art COLMAP + 3DGS', color: 'accent-cyan' },
            { icon: '🌐', title: 'Web Viewer', desc: 'Interactive 3D viewing in browser', color: 'accent-purple' },
          ].map((feature, i) => (
            <div key={i} className={`card p-6 animate-fade-up opacity-0 stagger-${i + 2}`}>
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-text-primary mb-2">{feature.title}</h3>
              <p className="text-text-secondary text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
