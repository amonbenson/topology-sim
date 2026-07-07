# Topology Simulator

## Technology Stack

[Vue 3](https://vuejs.org/) · [Vite](https://vitejs.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS v4](https://tailwindcss.com/) · [PrimeVue](https://primevue.org/)

## Project Structure

```
src/
├── views/          # Page components
├── components/     # Reusable UI components
├── composables/    # Reactive logic
├── core/           # Simulation logic
├── stores/         # App state
└── router/         # Vue Router routes
```

## Development Setup

Node.js 20.19+ or 22.12+ is required.

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run typecheck # TypeScript validation
npm run lint:fix  # auto-fix linting issues
npm run build     # production build → dist/
npm run test      # unit tests
```

## Deployment

Pushing to `main` triggers the GitHub Actions CI pipeline, which lints, type-checks, builds, and deploys the app to GitHub Pages.

## Detection Algorithm

```
Notation: arms A,B,C (index 0,1,2); Rp[·] = known per-arm pull resistance;
VH,VL = supply rail voltages (unknown, measured); ⊥ = undefined (NaN).
Thresholds: εV (open), εS (short), εI (loop-current), εC (consistency).

──────────────────────────────────────────────────────────────────
Algorithm 1  Calibrate()                    ▷ measure the unknown rails
──────────────────────────────────────────────────────────────────
1:  drive A HIGH; float B, C
2:  VH ← voltage(A)                         ▷ zero current ⇒ exact reading
3:  drive A LOW; float B, C
4:  VL ← voltage(A)
5:  return VH, VL

──────────────────────────────────────────────────────────────────
Algorithm 2  Measure(i, j)                  ▷ drive i HIGH, j LOW, k floating
──────────────────────────────────────────────────────────────────
Require: VH, VL from Calibrate(); Rp[i], Rp[j]
1:  drive i HIGH, j LOW, k ← {A,B,C} \ {i,j} FLOATING
2:  Vi, Vj, Vk ← voltage(i), voltage(j), voltage(k)
3:  Ij ← (Vj − VL) / Rp[j];  Ii ← (VH − Vi) / Rp[i]
4:  require |Ij − Ii| ≤ εI                  ▷ same current both sides of the loop
5:  if Vj − VL ≤ εV then return (conducts = false)
6:  Rpair ← (VH − VL)·Rp[j] / (Vj − VL) − Rp[i] − Rp[j]
7:  ρ ← (Vk − Vj) / (Vi − Vj)               ▷ j's share of Rpair
8:  return (conducts = true, Rpair, ρ)

──────────────────────────────────────────────────────────────────
Algorithm 3  Solve()                        ▷ returns (rA,rB,rC), Rtotal
──────────────────────────────────────────────────────────────────
1:  VH, VL ← Calibrate()
2:  Mab ← Measure(A,B);  Mbc ← Measure(B,C)
3:  if Mab.conducts ∧ Mbc.conducts then
4:      if Mab.Rpair ≤ εS ∧ Mbc.Rpair ≤ εS then return (0,0,0), ⊥
5:      if Mab.Rpair ≤ εS                 then return (0,0,1), Mbc.Rpair
6:      if Mbc.Rpair ≤ εS                 then return (1,0,0), Mab.Rpair
7:      wA,wB,wC ← (1−ρab)(1−ρbc), ρab(1−ρbc), ρab·ρbc
8:      rA,rB,rC ← (wA,wB,wC) / (wA+wB+wC)
9:      Sab ← Mab.Rpair/(rA+rB);  Sbc ← Mbc.Rpair/(rB+rC)
10:     require |Sab − Sbc| / (Sab+Sbc) ≤ εC
11:     return (rA,rB,rC), (Sab+Sbc)/2
12: else if Mab.conducts then                ▷ C isolated
13:     return Mab.Rpair ≤ εS ? [(0,0,∞), ⊥] : [(⊥,⊥,∞), Mab.Rpair]
14: else if Mbc.conducts then                ▷ A isolated
15:     return Mbc.Rpair ≤ εS ? [(∞,0,0), ⊥] : [(∞,⊥,⊥), Mbc.Rpair]
16: else
17:     Mca ← Measure(C,A)                   ▷ B must be isolated — confirm
18:     if ¬Mca.conducts then return (∞,∞,∞), ⊥
19:     return Mca.Rpair ≤ εS ? [(0,∞,0), ⊥] : [(⊥,∞,⊥), Mca.Rpair]
```
