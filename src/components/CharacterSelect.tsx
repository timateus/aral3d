import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';

export interface CharacterDef {
  id: string;
  name: string;
  bodyColor: string;
  hatColor: string;
  glowColor: string;
  cheekColor: string;
  emoji: string;
  description: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'sunny',
    name: 'Sunny',
    bodyColor: '#f0c674',
    hatColor: '#8ec8e8',
    glowColor: '#f0c674',
    cheekColor: '#e8a0bf',
    emoji: '☀️',
    description: 'Тёплый и яркий искатель приключений',
  },
  {
    id: 'aqua',
    name: 'Aqua',
    bodyColor: '#4fc3f7',
    hatColor: '#1565c0',
    glowColor: '#4fc3f7',
    cheekColor: '#80deea',
    emoji: '💧',
    description: 'Дух воды Аральского моря',
  },
  {
    id: 'desert',
    name: 'Desert',
    bodyColor: '#e8a87c',
    hatColor: '#d35400',
    glowColor: '#e8a87c',
    cheekColor: '#f5cba7',
    emoji: '🏜️',
    description: 'Выносливый житель пустыни',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    bodyColor: '#66bb6a',
    hatColor: '#2e7d32',
    glowColor: '#66bb6a',
    cheekColor: '#a5d6a7',
    emoji: '🌿',
    description: 'Хранитель зелёных оазисов',
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    bodyColor: '#ab47bc',
    hatColor: '#6a1b9a',
    glowColor: '#ab47bc',
    cheekColor: '#ce93d8',
    emoji: '💎',
    description: 'Мистический странник',
  },
  {
    id: 'coral',
    name: 'Coral',
    bodyColor: '#ef5350',
    hatColor: '#b71c1c',
    glowColor: '#ef5350',
    cheekColor: '#ef9a9a',
    emoji: '🔥',
    description: 'Огненный исследователь',
  },
];

interface CharacterSelectProps {
  onSelect: (character: CharacterDef) => void;
  onBack: () => void;
}

export default function CharacterSelect({ onSelect, onBack }: CharacterSelectProps) {
  const [selected, setSelected] = useState<string>('sunny');

  const char = CHARACTERS.find(c => c.id === selected)!;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-2xl w-full mx-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground flex items-center justify-center gap-3">
            <Gamepad2 className="w-8 h-8 text-primary" />
            Выбери персонажа
          </h2>
          <p className="text-muted-foreground text-sm">Выбери своего героя для исследования Аральского моря</p>
        </div>

        {/* Character grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {CHARACTERS.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`
                relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300
                ${selected === c.id
                  ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20'
                  : 'border-border/30 bg-card/40 hover:bg-card/60 hover:border-border/60'}
              `}
            >
              {/* Mini avatar preview */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: c.bodyColor + '33', border: `2px solid ${c.bodyColor}` }}
              >
                {c.emoji}
              </div>
              <span className="text-xs font-medium text-foreground">{c.name}</span>
              {selected === c.id && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[8px] text-primary-foreground">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Selected character info */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: char.bodyColor + '33', border: `3px solid ${char.bodyColor}` }}
          >
            {char.emoji}
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg">{char.name}</h3>
            <p className="text-muted-foreground text-sm">{char.description}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg border border-border/30 bg-card/40 text-muted-foreground hover:bg-card/60 transition-colors text-sm"
          >
            ← Назад
          </button>
          <button
            onClick={() => onSelect(char)}
            className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm"
          >
            Играть за {char.name} →
          </button>
        </div>
      </div>
    </div>
  );
}
