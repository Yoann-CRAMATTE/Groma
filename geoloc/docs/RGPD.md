# Données personnelles — onglet SPANC

## Constat

L'onglet **SPANC** et son fichier `spanc.csv` enregistrent, pour chaque installation :

- `latitude` / `longitude` / `x_l93` / `y_l93` — localisation de l'installation
- `type_materiel` / `modele` / `detail` — nature du dispositif en place
- `date_saisie` / `operateur` — qui est passé, et quand

Depuis la v0.7, **ni nom, ni adresse, ni parcelle ne sont saisis**. Cela ne sort pas
le traitement du RGPD : une installation d'assainissement non collectif se trouve chez
un particulier, et une position à quelques mètres près désigne un foyer aussi sûrement
qu'une adresse. Associée à la nature du dispositif, elle reste une donnée à caractère
personnel au sens du **règlement (UE) 2016/679**.

Ce qui change : le risque en cas de fuite est moindre — il faut un recoupement
cadastral pour nommer quelqu'un — mais la qualification juridique, elle, tient.

Les onglets EAU et ASSAINISSEMENT portent sur des ouvrages publics et ne sont pas
concernés.

## Ce que fait l'application

- Les données restent dans le navigateur (`localStorage`) et dans le fichier `spanc.csv` choisi.
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
- **Sécurité du support** — le fichier `spanc.csv` et le navigateur ne sont pas chiffrés. Un poste
  ou un téléphone perdu expose les données. Chiffrement du disque et verrouillage
  de session à prévoir.
- **Destinataires** — qui reçoit le fichier `spanc.csv`, par quel canal. Le fichier étant séparé de ceux des ouvrages publics, il peut être diffusé indépendamment.
- **Recoupement** — croiser `spanc.csv` avec le cadastre ou un fichier d'usagers
  reconstitue l'identité des propriétaires. C'est un traitement en soi, à couvrir.

> Rédigé comme point de vigilance technique. Ce document n'est pas un avis juridique :
> le DPO de la collectivité tranche.
