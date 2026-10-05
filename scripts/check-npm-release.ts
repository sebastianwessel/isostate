export const publishedPackages = [
	'@sebastianwessel/isostate',
	'@sebastianwessel/isostate-cli'
] as const;

/** Fail closed when a registry check cannot establish an unpublished version. */
export async function checkNpmRelease(
	version: string,
	request: (url: string, init?: RequestInit) => Promise<Response> = fetch
): Promise<void> {
	await Promise.all(
		publishedPackages.map(async (name) => {
			const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
			let response: Response;
			try {
				response = await request(url, { signal: AbortSignal.timeout(10_000) });
			} catch (error) {
				throw new Error(
					`Cannot verify ${name}@${version}: registry request failed`,
					{
						cause: error
					}
				);
			}
			if (response.status === 404) return;
			if (response.ok) {
				throw new Error(`${name}@${version} is already published`);
			}
			throw new Error(
				`Cannot verify ${name}@${version}: registry returned HTTP ${response.status}`
			);
		})
	);
}

if (import.meta.main) {
	const version = process.argv[2];
	if (!version)
		throw new Error('Usage: bun scripts/check-npm-release.ts <version>');
	await checkNpmRelease(version);
	console.log(`Both npm packages are unpublished at ${version}.`);
}
