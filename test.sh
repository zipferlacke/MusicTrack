#!/bin/bash

JSON_FILE="js/update.json"

# 1. Prüfen ob jq installiert ist
if ! command -v jq &> /dev/null; then
    echo "Fehler: 'jq' wird benötigt. Installiere es mit 'sudo apt install jq'."
    exit 1
fi

VERSION=$(jq -r '.changelog[0].version' "$JSON_FILE")
MESSAGE=$(jq -r '.changelog[0].changes | map("" + .) | .[]' "$JSON_FILE")

TAG_EXISTS=$(git tag -l "v$VERSION")

echo "-----------------------------------"
echo "RELEASE DATEN: "
echo "Version $VERSION"
echo "$MESSAGE"
echo "-----------------------------------"

echo ""
if [ -n "$TAG_EXISTS" ]; then
    echo "MODUS: ÜBERSCHREIBEN (Amend) -- v$VERSION existiert bereits"
else
    echo "Modus: NEU"
fi

echo ""
read -p "Fortfahren mit den Daten? (y/n): " confirm
if [ "$confirm" != "y" ]; then 
    echo "Abbruch kein Release erstellt ..."
    exit 1;
fi

git checkout release
git checkout main -- .                                      # Holt Aktuellen Stand von main
git add .                                                   # Fügt alle Files zu commit

if [ -n "$TAG_EXISTS" ]; then
    git commit --amend -m "Version $VERSION" -m "$MESSAGE"  # Commit Erweitern mit Versionsänderung
    git tag -d "v$VERSION"
    git push origin --delete "v$VERSION"
else
    git commit -m "Version $VERSION" -m "$MESSAGE"          # Commit mit Versionsänderung
fi
git tag -a "v$VERSION" -m "Version $VERSION" -m "$MESSAGE"  # Erstellt Tag

echo ""
read -p "Soll Version $VERSION jetzt zu GitHub gepusht werden? (y/n): " confirm

if [ "$confirm" == "y" ]; then
    if [ -n "$TAG_EXISTS" ]; then
        git push origin release --force
    else
        git push origin release
    fi
    git push origin "v$VERSION"

    echo "Release: Version $VERSION ist live bei GitHub."
else
    echo "Release: Version $VERSION ist lokal."
fi