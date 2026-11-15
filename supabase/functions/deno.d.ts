// Le strict nécessaire des API Deno utilisées par les fonctions, pour la vérification TypeScript.
declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}
