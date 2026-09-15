/*
 * Minimal WebAuthn browser-side helpers: base64url <-> ArrayBuffer conversion
 * and the two ceremony wrappers (register/authenticate) around
 * navigator.credentials.create()/get(). No external library — the server's
 * @simplewebauthn/server options/response shapes are the standard
 * PublicKeyCredentialCreationOptionsJSON / RequestOptionsJSON already.
 */
function base64urlToBuffer(base64url) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(base64url.length + (4 - (base64url.length % 4)) % 4, '=');
  const binary = atob(padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isWebauthnSupported() {
  return typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator.credentials);
}

async function webauthnRegister(optionsJSON) {
  const publicKey = {
    ...optionsJSON,
    challenge: base64urlToBuffer(optionsJSON.challenge),
    user: {
      ...optionsJSON.user,
      id: base64urlToBuffer(optionsJSON.user.id),
    },
    excludeCredentials: (optionsJSON.excludeCredentials || []).map((entry) => ({
      ...entry,
      id: base64urlToBuffer(entry.id),
    })),
  };

  const credential = await navigator.credentials.create({ publicKey });
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      attestationObject: bufferToBase64url(credential.response.attestationObject),
      transports: credential.response.getTransports ? credential.response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
  };
}

async function webauthnAuthenticate(optionsJSON) {
  const publicKey = {
    ...optionsJSON,
    challenge: base64urlToBuffer(optionsJSON.challenge),
    allowCredentials: (optionsJSON.allowCredentials || []).map((entry) => ({
      ...entry,
      id: base64urlToBuffer(entry.id),
    })),
  };

  const credential = await navigator.credentials.get({ publicKey });
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64url(credential.response.authenticatorData),
      signature: bufferToBase64url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
  };
}
