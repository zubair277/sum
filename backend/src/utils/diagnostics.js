// Fixed allowlists prevent credentials, request URLs, prompts and raw SDK errors entering logs.
const networkCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_BAD_RESPONSE']);
export function networkDiagnostics(error) {
  const code = error.code || error.cause?.code;
  return { exception: error.name === 'AxiosError' ? 'AxiosError' : error.name === 'ApiError' ? 'ApiError' : 'Error', networkCode: networkCodes.has(code) ? code : undefined };
}
export function withDiagnostics(error, diagnostics) {
  error.diagnostics = diagnostics;
  return error;
}
