// Texte affiché pour chaque code d'erreur du script ou du réseau.
export function messageErreur(error) {
  switch (error) {
    case 'auth': return 'PIN refusé';
    case 'bloque': return 'Trop d\'essais de PIN : réessaie dans 15 minutes';
    case 'reseau': return 'hors ligne';
    case 'injoignable': return 'script injoignable : vérifie l\'adresse /exec et que le déploiement est ouvert à « Tout le monde »';
    case 'delai': return 'le script met trop de temps à répondre';
    case 'format': return 'réponse illisible du script : code mal collé ou déploiement non autorisé (lance diagnostic dans Apps Script)';
    case 'serveur': return 'erreur du script : propriété CONFIG absente ou mal formée (lance diagnostic dans Apps Script)';
    case 'config': return 'CONFIG incomplète ou invalide (lance diagnostic dans Apps Script)';
    case 'http': return 'le script a répondu par une erreur Google (réessaie, puis vérifie le déploiement)';
    case 'pin': return 'PIN manquant';
    case 'categorie': return 'catégorie inconnue du script (mets Code.gs à jour)';
    case 'nom': return 'nom manquant';
    case 'prix': return 'prix invalide';
    case 'sku': return 'SKU invalide';
    default: return 'erreur du script (' + (error || 'réponse invalide') + ')';
  }
}
