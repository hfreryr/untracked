"""Les fichiers de calcul (.github/workflows/*.yml) sont-ils acceptés par GitHub ? (06/11/2026 : une étape écrite
« run: { … } » était lue comme un dictionnaire ; GitHub a refusé le fichier entier, sans lancer aucun calcul.)
Vérifie : YAML lisible, chaque étape a « run » en texte ou « uses », chaque tâche a des étapes. Code 1 sinon."""
import glob, sys, yaml

bad = []
for f in sorted(glob.glob(".github/workflows/*.yml")):
    d = yaml.safe_load(open(f))
    for name, job in (d.get("jobs") or {}).items():
        steps = job.get("steps")
        if not isinstance(steps, list) or not steps:
            bad.append(f"{f} : tâche « {name} » sans étapes")
            continue
        for i, st in enumerate(steps):
            if "run" in st and not isinstance(st["run"], str):
                bad.append(f"{f} : étape {i + 1} (« {st.get('name', '')} ») : « run » n'est pas du texte")
            if "run" not in st and "uses" not in st:
                bad.append(f"{f} : étape {i + 1} sans « run » ni « uses »")
print("\n".join(bad) or "fichiers de calcul : ok")
sys.exit(1 if bad else 0)
