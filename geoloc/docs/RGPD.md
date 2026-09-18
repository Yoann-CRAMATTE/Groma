# Données personnelles — onglet SPANC

## Constat

L'onglet **SPANC** enregistre, pour chaque installation :

- `proprietaire` — nom d'une personne physique
- `adresse` — adresse du domicile
- `parcelle` — référence cadastrale, identifiant indirect
- `latitude` / `longitude` / `x_l93` / `y_l93` — localisation du domicile
- `conformite` / `date_controle` — appréciation portée sur le bien

Ces données constituent un traitement de données à caractère personnel au sens du
**règlement (UE) 2016/679 (RGPD)**. Les onglets EAU et ASSAINISSEMENT portent sur des
ouvrages publics et ne sont pas concernés.

## Ce que fait l'application

- Les données restent dans le navigateur (`localStorage`) et dans le fichier CSV choisi.
- Aucun envoi réseau : aucune requête sortante hors le lien OpenStreetMap ouvert
  manuellement par l'agent.
- Aucun compte, aucune télémétrie, aucun script tiers.
- L'effacement complet est disponible dans Configuration.

## Ce que l'application ne règle pas

Ces points relèvent de la collectivité, pas de l'outil :

- **Base légale** — pour un SPANC, mission d'intérêt public (art. 6.1.e RGPD),
  adossée aux articles L. 2224-8 et suivants du code général des collectivités
  territoriales.
- **Durée de conservation** — à fixer et à appliquer ; l'application ne purge rien
  automatiquement.
- **Information des personnes** — mention d'information lors du contrôle.
- **Registre des traitements** — inscription du traitement.
- **Sécurité du support** — le CSV et le navigateur ne sont pas chiffrés. Un poste
  ou un téléphone perdu expose les données. Chiffrement du disque et verrouillage
  de session à prévoir.
- **Destinataires** — qui reçoit le CSV, par quel canal.

> Rédigé comme point de vigilance technique. Ce document n'est pas un avis juridique :
> le DPO de la collectivité tranche.
