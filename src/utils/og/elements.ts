// Minimal hyperscript helper so card templates can build Satori's element
// tree ({type, props: {style, children}}) without pulling in React/JSX
// tooling just for this one endpoint family.

export type SatoriNode = {
	type: string;
	props: Record<string, unknown>;
};

type Child = SatoriNode | string | number | null | false | undefined;

export function h(
	type: string,
	style: Record<string, unknown> = {},
	...children: (Child | Child[])[]
): SatoriNode {
	const flat = children.flat().filter((c): c is SatoriNode | string | number => c !== null && c !== false && c !== undefined);
	return {
		type,
		props: {
			style,
			children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat,
		},
	};
}
