import LoginForm from './LoginForm';

export const metadata = {
  title: 'Iniciar Sesión | MultiTenant SaaS',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 w-full flex justify-center px-4">
        <LoginForm />
      </div>
    </main>
  );
}
