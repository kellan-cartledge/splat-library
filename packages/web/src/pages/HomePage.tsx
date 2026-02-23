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
            { icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-accent-yellow"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>, title: 'Fast Processing', desc: 'GPU-accelerated pipeline with AWS Batch', color: 'accent-yellow' },
            { icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-accent-cyan"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>, title: 'High Quality', desc: 'State-of-the-art SfM + 3DGS', color: 'accent-cyan' },
            { icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-accent-purple"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" /></svg>, title: 'Web Viewer', desc: 'Interactive 3D viewing in browser', color: 'accent-purple' },
          ].map((feature, i) => (
            <div key={i} className={`card p-6 animate-fade-up opacity-0 stagger-${i + 2}`}>
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-text-primary mb-2">{feature.title}</h3>
              <p className="text-text-secondary text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
