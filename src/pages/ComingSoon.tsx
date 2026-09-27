import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  phaseNote: string;
}

export default function ComingSoon({ title, phaseNote }: ComingSoonProps) {
  return (
    <div className="min-h-screen gradient-bg text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600/20 rounded-2xl mb-4">
          <Construction className="w-7 h-7 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-dark-400">{phaseNote}</p>
      </div>
    </div>
  );
}
