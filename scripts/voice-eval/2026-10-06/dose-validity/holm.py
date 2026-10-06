# Holm correction within each experiment's family of reported tests. Read-only inputs:
#  adv-c8/stats.mjs output (re-run here, read-only), verify-c4/stats2.mjs + ci.mjs output (re-run),
#  verify-c4/ablate.json summary, exp-review/analysis.json (original parser, superseded),
#  verifier-c6 recomputed by perms.mjs (reproduces RESULTS.txt exactly), and perms.mjs dose tests.
import json, os
from math import comb
HERE = os.path.dirname(os.path.abspath(__file__))
SLM = os.path.dirname(HERE)

def binom2(w, l):
    n = w + l
    if n == 0: return 1.0
    k = min(w, l)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)

def holm(tests):
    m = len(tests); order = sorted(range(m), key=lambda i: tests[i][1])
    adj = [None] * m; run = 0.0
    for rank, i in enumerate(order):
        a = min(1.0, (m - rank) * tests[i][1]); run = max(run, a); adj[i] = run
    return adj

fam = {}
# F1: adv-c8/stats.mjs (exp-dose re-analysis) - printed values
fam['F1 adv-c8/stats.mjs on exp-dose (6 fidelity perm + 12 ident Fisher)'] = [
    ('FID marc N C1-C0', .309), ('FID marc C C1-C0', .689), ('FID marc ALL C1-C0', .259),
    ('FID grace N C1-C0', .458), ('FID grace C C1-C0', .006), ('FID grace ALL C1-C0', .011),
    ('IDENT-N sonnet pref marc', 1.0), ('IDENT-N sonnet pref grace', .474), ('IDENT-N sonnet pref both', .523),
    ('IDENT-N sonnet all4 marc', .141), ('IDENT-N sonnet all4 grace', 1.0), ('IDENT-N sonnet all4 both', .320),
    ('IDENT-N haiku pref marc', .023), ('IDENT-N haiku pref grace', .628), ('IDENT-N haiku pref both [draft 0.022]', .022),
    ('IDENT-N haiku all4 marc', .057), ('IDENT-N haiku all4 grace', .033), ('IDENT-N haiku all4 both [draft 0.001]', .001),
]
fam['F1b same, Fisher ident tests only (12)'] = fam['F1 adv-c8/stats.mjs on exp-dose (6 fidelity perm + 12 ident Fisher)'][6:]
fam['F1c same, only the 4 pooled "both" ident tests (most lenient family)'] = [t for t in fam['F1b same, Fisher ident tests only (12)'] if 'both' in t[0]]
# F2: verify-c4 rejudge (fixed parser) sign tests, W/L from stats2.mjs output
WL = [('K0b-vs-K0a pref', 7, 11), ('K1-vs-K0 pref', 7, 7), ('K3-vs-K0 pref', 7, 10), ('K10-vs-K0 pref', 7, 8), ('CLOSER50-vs-K0 pref [draft 0.001]', 16, 2),
      ('MOM-H2 pref warm', 0, 0), ('MOM-H2 pref voice', 2, 1), ('MOM-S1 pref warm', 3, 0), ('MOM-S1 pref voice', 3, 0),
      ('K0b-vs-K0a palette', 8, 7), ('K1-vs-K0 palette [draft whole-set 0.12]', 11, 4), ('K3-vs-K0 palette', 8, 4), ('K10-vs-K0 palette', 8, 4), ('CLOSER50-vs-K0 palette', 18, 2),
      ('MOM-H2 palette warm', 3, 1), ('MOM-H2 palette voice', 1, 1), ('MOM-S1 palette warm', 2, 1), ('MOM-S1 palette voice', 1, 1)]
f2 = [(n, binom2(w, l)) for n, w, l in WL]
fam['F2 verify-c4 rejudge sign tests (18)'] = f2
f2b = f2 + [('pooled K1+K3+K10 pref (non-independent)', binom2(21, 25)), ('pooled K1+K3+K10 palette (non-independent)', binom2(27, 12))]
fam['F2b rejudge 18 + 2 pooled'] = f2b
f3 = [('FLIP-vs-K0', binom2(11, 7)), ('CLOSER50-vs-FLIP', binom2(11, 8)), ('K0-vs-NULLH', binom2(6, 9)), ('K1-vs-NULLH', binom2(7, 11)), ('K10-vs-NULLH', binom2(5, 13))]
fam['F3 verify-c4 ablate.json sign tests (5)'] = f3
fam['F2+F3 whole exp-review/verify-c4 judging family (25)'] = f2b + f3
# F5 original exp-review parser (superseded by rejudge)
A = json.load(open(os.path.join(SLM, 'exp-review', 'analysis.json'), encoding='utf8'))
fam['F5 exp-review ORIGINAL parser signP (18, superseded)'] = [(f"{g['name']} {g['unit']} {g['kind']}", float(g['signP'])) for g in A['groups']]
# F4 verifier-c6 recompute (16) + C8 vs C4
PO = json.load(open(os.path.join(HERE, 'perms-out.json'), encoding='utf8'))
f4 = [(t['test'], t['p']) for t in PO['c6']] + [('exp-dose C8-C4 Marc PREFERRED words (as reported)', 0.30)]
fam['F4 verifier-c6 all slot x contrast word-count perm tests (16) + C8vsC4 (17)'] = f4
fam['F4b verifier-c6 only the 5 tests RESULTS.txt printed with values + C8vsC4'] = [t for t in f4 if t[0] in ('PREFERRED K0-NULLH', 'PREFERRED LEANONLY-NULLH', 'PREFERRED EXONLY-NULLH', 'PREFERRED K0-LEANONLY', 'REPAIR LEANONLY-NULLH') or t[0].startswith('exp-dose')]
# F6 new: exp-dose fidelity table permutation tests (this reanalysis)
fam['F6 exp-dose fidelity Marc (13 contrasts, this reanalysis)'] = [(t['test'], t['p']) for t in PO['dose'] if t['persona'] == 'marc-delgado']
fam['F6 exp-dose fidelity Grace (9 contrasts, this reanalysis)'] = [(t['test'], t['p']) for t in PO['dose'] if t['persona'] == 'grace-thompson']

lines = []
for name, tests in fam.items():
    adj = holm(tests)
    lines.append(f"\n=== {name}  (m={len(tests)})")
    for (n, p), a in sorted(zip(tests, adj), key=lambda x: x[0][1]):
        lines.append(f"  {n:<58} raw p={p:.4f}  Holm p={a:.4f}  {'SURVIVES .05' if a < .05 else ('raw<.05 FAILS' if p < .05 else '')}")
print('\n'.join(lines))
open(os.path.join(HERE, 'holm-out.txt'), 'w', encoding='utf8').write('\n'.join(lines))
