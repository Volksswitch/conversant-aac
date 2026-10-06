# Read-only reanalysis: fidelity ~ words + shared-marker (+ condition). numpy only.
import json, re, itertools, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, 'data.json'), encoding='utf8'))
rows = D['rows']; anchors = D['anchors']
CONDS = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']
rng = np.random.default_rng(20261006)
OUT = {}

def ols(X, y):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    res = y - X @ beta
    ss_res = float(res @ res); ss_tot = float(((y - y.mean()) ** 2).sum())
    n, k = X.shape
    r2 = 1 - ss_res / ss_tot
    adj = 1 - (1 - r2) * (n - 1) / (n - k)
    return beta, r2, adj, res

def design(rs, conds, covs, base='C0', turnfe=False):
    cols = [np.ones(len(rs))]; names = ['const']
    for c in conds:
        if c == base: continue
        cols.append(np.array([1.0 if r['cond'] == c else 0.0 for r in rs])); names.append(c)
    for cv in covs:
        cols.append(np.array([float(cv(r)) for r in rs])); names.append(cv.__name__)
    if turnfe:
        turns = sorted(set(r['turn'] for r in rs))
        for t in turns[1:]:
            cols.append(np.array([1.0 if r['turn'] == t else 0.0 for r in rs])); names.append('turn:' + t)
    return np.column_stack(cols), names

def words(r): return r['words']
def marker(r): return r['anySharedMarker']
def nmarker(r): return r['nSharedMarker']
def logwords(r): return np.log(r['words'])
def refmarker(r): return r['anyRefMarker']

def lsmeans(beta, names, conds, covvals, base='C0', turnfe_mean=None):
    # adjusted mean per condition at covariate means (and averaged turn effects)
    idx = {n: i for i, n in enumerate(names)}
    out = {}
    for c in conds:
        v = beta[0]
        if c != base: v += beta[idx[c]]
        for n, m in covvals.items(): v += beta[idx[n]] * m
        if turnfe_mean is not None:
            for n, m in turnfe_mean.items(): v += beta[idx[n]] * m
        out[c] = float(v)
    return out

def freedman_lane(rs, conds, covs, nperm=10000, turnfe=False):
    # permutation F-test for condition AFTER covariates: permute residuals of the reduced model
    y = np.array([r['score'] for r in rs], float)
    Xr, _ = design(rs, [], covs, turnfe=turnfe)
    Xf, _ = design(rs, conds, covs, turnfe=turnfe)
    br, r2r, _, resr = ols(Xr, y)
    fit_r = Xr @ br
    def F(yv):
        _, _, _, rr = ols(Xr, yv); _, _, _, rf = ols(Xf, yv)
        ssr, ssf = rr @ rr, rf @ rf
        df1 = Xf.shape[1] - Xr.shape[1]; df2 = len(yv) - Xf.shape[1]
        return ((ssr - ssf) / df1) / (ssf / df2)
    f0 = F(y); c = 0
    for _ in range(nperm):
        if F(fit_r + rng.permutation(resr)) >= f0 - 1e-12: c += 1
    return float(f0), (c + 1) / (nperm + 1)

report = []
def P(*a):
    s = ' '.join(str(x) for x in a); report.append(s); print(s)

for persona in ['marc-delgado', 'grace-thompson']:
    rs = [r for r in rows if r['persona'] == persona]
    conds = [c for c in CONDS if any(r['cond'] == c for r in rs)]
    y = np.array([r['score'] for r in rs], float)
    P('\n==========', persona, 'n =', len(rs), 'conds', conds)
    # descriptive per condition
    P('cond | n | raw mean fid | mean words | share with shared marker | mean nSharedMarker | share nah/ugh')
    desc = {}
    for c in conds:
        cr = [r for r in rs if r['cond'] == c]
        desc[c] = dict(n=len(cr), fid=np.mean([r['score'] for r in cr]), words=np.mean([r['words'] for r in cr]),
                       marker=np.mean([r['anySharedMarker'] for r in cr]), nmarker=np.mean([r['nSharedMarker'] for r in cr]),
                       nahugh=np.mean([r['nahUgh'] for r in cr]))
        d = desc[c]; P(f"{c} | {d['n']} | {d['fid']:.2f} | {d['words']:.2f} | {d['marker']:.2f} | {d['nmarker']:.2f} | {d['nahugh']:.2f}")
    # correlations
    w = np.array([r['words'] for r in rs], float); m = np.array([r['anySharedMarker'] for r in rs], float)
    P('corr(score, words) =', round(float(np.corrcoef(y, w)[0, 1]), 3), '| corr(score, anySharedMarker) =', round(float(np.corrcoef(y, m)[0, 1]), 3), '| corr(words, marker) =', round(float(np.corrcoef(w, m)[0, 1]), 3))
    res_p = {'desc': desc}
    specs = [
        ('MAIN words + anySharedMarker', [words, marker], False),
        ('ALT logwords + nSharedMarker', [logwords, nmarker], False),
        ('ALT words + anyRefMarker', [words, refmarker], False),
        ('MAIN + turn fixed effects', [words, marker], True),
    ]
    for label, covs, tfe in specs:
        Xc, nc = design(rs, conds, [], turnfe=tfe)
        Xv, nv = design(rs, [], covs, turnfe=tfe)
        Xf, nf = design(rs, conds, covs, turnfe=tfe)
        bc, r2c, adjc, _ = ols(Xc, y); bv, r2v, adjv, _ = ols(Xv, y); bf, r2f, adjf, _ = ols(Xf, y)
        # turn-only baseline for the tfe spec
        if tfe:
            Xt, _ = design(rs, [], [], turnfe=True); _, r2t, _, _ = ols(Xt, y)
        else:
            r2t = 0.0
        cond_alone = r2c - r2t
        cond_after = r2f - r2v
        shared = cond_alone - cond_after
        covvals = {cv.__name__: float(np.mean([cv(r) for r in rs])) for cv in covs}
        tmean = None
        if tfe:
            turns = sorted(set(r['turn'] for r in rs))
            tmean = {'turn:' + t: float(np.mean([1.0 if r['turn'] == t else 0.0 for r in rs])) for t in turns[1:]}
        raw = {c: desc[c]['fid'] for c in conds}
        adj = lsmeans(bf, nf, conds, covvals, turnfe_mean=tmean)
        coefs = {n: round(float(b), 3) for n, b in zip(nf, bf) if n in [cv.__name__ for cv in covs]}
        P(f"\n-- {label}")
        P(f"R2: cond-only {r2c:.3f} (adj {adjc:.3f}) | covariates-only {r2v:.3f} (adj {adjv:.3f}) | full {r2f:.3f} (adj {adjf:.3f})" + (f" | turn-only {r2t:.3f}" if tfe else ''))
        P(f"condition R2 alone {cond_alone:.3f}; unique to condition after covariates {cond_after:.3f}; overlap with covariates {shared:.3f} = {100*shared/cond_alone:.0f}% of condition's R2")
        P('covariate coefs in full model:', json.dumps(coefs))
        # spread of condition means (unweighted SD) raw vs adjusted
        rv = np.array([raw[c] for c in conds]); av = np.array([adj[c] for c in conds])
        P(f"range of condition means raw {rv.max()-rv.min():.2f} -> adjusted {av.max()-av.min():.2f}; SD raw {rv.std():.3f} -> adj {av.std():.3f}")
        P('cond | raw | adjusted | raw-C0 | adj-C0')
        for c in conds: P(f"{c} | {raw[c]:.2f} | {adj[c]:.2f} | {raw[c]-raw['C0']:+.2f} | {adj[c]-adj['C0']:+.2f}")
        contr = {}
        for a, b in [('C7', 'C0'), ('C4', 'C0'), ('C1', 'C0'), ('C5', 'C4'), ('C7', 'C4'), ('C2', 'C1'), ('C6', 'C4')]:
            if a in raw and b in raw:
                rd = raw[a] - raw[b]; ad = adj[a] - adj[b]
                contr[f'{a}-{b}'] = (rd, ad)
                P(f"contrast {a}-{b}: raw {rd:+.2f} adjusted {ad:+.2f}" + (f" (covariates account for {100*(1-ad/rd):.0f}%)" if abs(rd) > 1e-9 else ''))
        f0, pfl = freedman_lane(rs, conds, covs, nperm=5000, turnfe=tfe)
        P(f"Freedman-Lane permutation F for condition after covariates: F={f0:.2f} p={pfl:.4f}")
        res_p[label] = dict(r2_cond=r2c, r2_cov=r2v, r2_full=r2f, adj_r2_full=adjf, r2_turn=r2t, cond_unique=cond_after, cond_overlap=shared, raw=raw, adj=adj, coefs=coefs, contrasts=contr, fl_F=f0, fl_p=pfl)
    OUT[persona] = res_p

    # gen + anchors: what does the score track overall?
    ar = [a for a in anchors if a['persona'] == persona]
    allr = rs + ar
    ya = np.array([r['score'] for r in allr], float)
    Xa, na = design(allr, [], [words, marker])
    ba, r2a, adja, _ = ols(Xa, ya)
    P(f"\n-- gen cards + anchors (n={len(allr)}; ceiling = own unseen pool lines, floor = other persona's pool): score ~ words + anySharedMarker R2 {r2a:.3f} coefs {json.dumps({n: round(float(b),3) for n,b in zip(na, ba)})}")
    for kind in ['ceiling', 'floor']:
        kk = [a for a in ar if a['kind'] == kind]
        P(f"   {kind}: n {len(kk)} mean score {np.mean([a['score'] for a in kk]):.2f} mean words {np.mean([a['words'] for a in kk]):.2f} share shared-marker {np.mean([a['anySharedMarker'] for a in kk]):.2f}")
    # anchors alone
    Xo, no = design(ar, [], [words, marker]); yo = np.array([a['score'] for a in ar], float)
    bo, r2o, _, _ = ols(Xo, yo)
    P(f"   anchors alone (n={len(ar)}): R2 {r2o:.3f}")

# ---- Marc: fidelity by marker within condition, and C7 cards in full
P('\n========== Marc: mean fidelity by marker presence within condition')
marc = [r for r in rows if r['persona'] == 'marc-delgado']
for c in CONDS:
    cr = [r for r in marc if r['cond'] == c]
    if not cr: continue
    w1 = [r['score'] for r in cr if r['anySharedMarker']]; w0 = [r['score'] for r in cr if not r['anySharedMarker']]
    P(f"{c}: with marker n={len(w1)} mean={np.mean(w1) if w1 else float('nan'):.2f} | without n={len(w0)} mean={np.mean(w0) if w0 else float('nan'):.2f}")
allw1 = [r['score'] for r in marc if r['anySharedMarker']]; allw0 = [r['score'] for r in marc if not r['anySharedMarker']]
P(f"ALL Marc: with marker n={len(allw1)} mean={np.mean(allw1):.2f} | without n={len(allw0)} mean={np.mean(allw0):.2f}")
# matched on words: bins
P('Marc cards by word-count bin x marker (n, mean score):')
for lo, hi in [(1, 4), (5, 6), (7, 8), (9, 11), (12, 40)]:
    b = [r for r in marc if lo <= r['words'] <= hi]
    b1 = [r['score'] for r in b if r['anySharedMarker']]; b0 = [r['score'] for r in b if not r['anySharedMarker']]
    P(f"  words {lo}-{hi}: with marker n={len(b1)} {np.mean(b1) if b1 else float('nan'):.2f} | without n={len(b0)} {np.mean(b0) if b0 else float('nan'):.2f}")
P('\nMarc C7 PREFERRED cards (rated):')
for r in sorted([r for r in marc if r['cond'] == 'C7'], key=lambda r: r['turn']):
    P(f"  {r['turn']:<10} score {r['score']} words {r['words']:>2} markers {r['sig']} | {r['text']}")
c7 = [r for r in marc if r['cond'] == 'C7']
c71 = [r['score'] for r in c7 if r['anySharedMarker']]; c70 = [r['score'] for r in c7 if not r['anySharedMarker']]
P(f"C7: with shared marker n={len(c71)} mean {np.mean(c71) if c71 else float('nan'):.2f}; without n={len(c70)} mean {np.mean(c70) if c70 else float('nan'):.2f}")
c7n = [r['score'] for r in c7 if r['nahUgh']]; c7nn = [r['score'] for r in c7 if not r['nahUgh']]
P(f"C7: with nah/ugh n={len(c7n)} mean {np.mean(c7n) if c7n else float('nan'):.2f}; without n={len(c7nn)} mean {np.mean(c7nn) if c7nn else float('nan'):.2f}")
# nah/ugh across all cards (all slots) per condition, both personas
P('\nnah/ugh occurrence per condition (PREFERRED rated card | any of the 4 cards), Marc:')
for c in CONDS:
    cr = [r for r in marc if r['cond'] == c]
    if not cr: continue
    pc = sum(r['nahUgh'] for r in cr)
    anyc = sum(1 for r in cr if any(x['nahUgh'] for x in r['allCards']))
    P(f"  {c}: PREFERRED {pc}/{len(cr)} | any card {anyc}/{len(cr)}")
# baseline frequency of each shared marker in C0 cards (no persona info; identical prompt for both personas), all slots
P('\nBase-model frequency of each shared/ref signature item in C0 (no persona) cards, all slots, both personas pooled:')
c0cards = [x for r in rows if r['cond'] == 'C0' for x in r['allCards']]
items = sorted(set(D['personas']['marc-delgado']['refSignature']) | set(D['personas']['grace-thompson']['refSignature']))
for it in items:
    k = sum(1 for x in c0cards if it in x['sig'])
    P(f"  {it!r}: {k}/{len(c0cards)} C0 cards")
json.dump(OUT, open(os.path.join(HERE, 'ols-results.json'), 'w'), indent=1, default=float)
open(os.path.join(HERE, 'ols-out.txt'), 'w', encoding='utf8').write('\n'.join(report))
