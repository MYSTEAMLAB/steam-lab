import React, { useEffect, useState } from 'react'
// @ts-ignore
import logoUrl from '../assets/logo.jpeg'
// @ts-ignore
import makeInIndiaUrl from '../assets/make-in-india.png'
// @ts-ignore
import robotFlagUrl from '../assets/robot-flag.jpg'

interface SplashScreenProps {
  /** Called once the whole intro sequence (including fade-out) has finished. */
  onDone: () => void
}

// Opening intro: the logo zooms in from a tiny background dot to its full
// size, "LET US BUILD" writes itself in underneath letter by letter, holds
// for a beat, then the whole thing fades out to reveal the app. Runs once
// per launch, ~6.5s total regardless of how fast board data actually loads —
// this is a deliberate "fun for kids" moment, not a loading indicator.
const MESSAGE = 'LET US BUILD'

/** Framed robot-holding-the-flag photo, with a small MY STEAM LAB badge over
 *  its chest. `flip` mirrors the whole card so the pair on either side of
 *  the splash face inward toward the logo. */
const FlagRobot: React.FC<{ flip?: boolean; animation: string }> = ({ flip, animation }) => (
  <div
    className="hidden sm:block w-28 md:w-36 shrink-0 bg-white rounded-2xl p-1.5 shadow-2xl"
    style={{ animation }}
  >
    <div className="relative overflow-hidden rounded-xl" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <img src={robotFlagUrl} alt="Robot holding the Indian flag" className="w-full h-auto object-cover" />
      <img
        src={logoUrl}
        alt=""
        className="absolute rounded-full object-cover ring-2 ring-white shadow-md"
        style={{ left: '56%', top: '46%', width: '15%', height: '15%' }}
      />
    </div>
  </div>
)

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [phase, setPhase] = useState<'grow' | 'write' | 'hold' | 'fade'>('grow')

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('write'), 1100),
      setTimeout(() => setPhase('hold'), 1100 + MESSAGE.length * 70 + 500),
      setTimeout(() => setPhase('fade'), 5600),
      setTimeout(() => onDone(), 6500)
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  // "PROUD TO SAY" + the Make in India badge hold until the letters have
  // finished writing themselves in, so nothing new is competing with that
  // animation while it's still running.
  const showProud = phase === 'hold' || phase === 'fade'

  return (
    <div
      className={`
        fixed inset-0 z-[999] flex items-center justify-center gap-4 md:gap-10
        bg-gradient-to-br from-primary-500 via-fuchsia-500 to-orange-400
        transition-opacity duration-700 ease-out
        ${phase === 'fade' ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
    >
      {/* Soft floating sparkle dots in the background for extra life */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/40 animate-float"
            style={{
              left: `${12 + i * 11}%`,
              top: `${20 + (i % 3) * 22}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + (i % 3)}s`
            }}
          />
        ))}
      </div>

      {/* Robot, left */}
      <FlagRobot animation="msl-splash-robot-l 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both" />

      <div className="flex flex-col items-center gap-5">
        {/* Logo: starts as a tiny dot, springs up to full size */}
        <div
          className="relative bg-white rounded-[2rem] p-4 shadow-2xl"
          style={{
            animation: 'msl-splash-grow 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) both'
          }}
        >
          <img src={logoUrl} alt="MY STEAM LAB" className="w-24 h-24 object-contain rounded-2xl" />
        </div>

        {/* "LET US BUILD" — letters fade/pop in one at a time */}
        <div className="font-display text-4xl md:text-5xl font-extrabold tracking-wide text-white drop-shadow-lg flex">
          {MESSAGE.split('').map((ch, i) => (
            <span
              key={i}
              className="inline-block"
              style={{
                opacity: phase === 'grow' ? 0 : undefined,
                animation:
                  phase !== 'grow'
                    ? `msl-splash-letter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.07}s both`
                    : undefined,
                minWidth: ch === ' ' ? '0.6em' : undefined
              }}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </div>

        {/* "PROUD TO SAY" + Make in India badge — fades/slides in once the
            headline above has finished writing itself. */}
        <div
          className="flex flex-col items-center gap-2 transition-all duration-500 ease-out"
          style={{
            opacity: showProud ? 1 : 0,
            transform: showProud ? 'translateY(0)' : 'translateY(10px)'
          }}
        >
          <span className="font-display text-sm md:text-base font-bold tracking-[0.25em] text-white/90">
            PROUD TO SAY
          </span>
          <img
            src={makeInIndiaUrl}
            alt="Make in India"
            className="h-12 md:h-14 w-auto rounded-lg shadow-lg ring-2 ring-white/40"
          />
        </div>
      </div>

      {/* Robot, right — mirrored so both flags face inward. */}
      <FlagRobot flip animation="msl-splash-robot-r 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both" />

      <style>{`
        @keyframes msl-splash-grow {
          0%   { transform: scale(0.04); opacity: 0.3; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes msl-splash-letter {
          0%   { transform: translateY(14px) scale(0.6); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes msl-splash-robot-l {
          0%   { transform: translateX(-40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes msl-splash-robot-r {
          0%   { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
