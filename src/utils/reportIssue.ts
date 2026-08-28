// src/utils/reportIssue.ts
//
// Builds a pre-filled GitHub issue URL for "Report a data issue" links.
// The repo is public, so a GitHub issue (via the "Data issue" form at
// .github/ISSUE_TEMPLATE/data_issue.yml) is the low-maintenance option —
// see docs/DATA_SOURCES.md. GitHub issue forms accept query params that
// match a field's `id` to pre-fill it, so this only ever sends context we
// already know server-side (page URL, entity, language) — never anything
// typed by the user.

const REPO = 'Xarli11/Pokepedia';

export type ReportableEntityType = 'pokemon' | 'move' | 'ability' | 'item';

export interface ReportIssueContext {
	entityType: ReportableEntityType;
	entitySlug: string;
	lang: string;
	/** Canonical Pokepedia URL of the page being reported from. */
	pageUrl: string;
}

export function buildReportIssueUrl(ctx: ReportIssueContext): string {
	const entity = `${ctx.entityType}/${ctx.entitySlug}`;
	const params = new URLSearchParams({
		template: 'data_issue.yml',
		title: `[data] ${entity}`,
		pokepedia_url: ctx.pageUrl,
		entity,
		language: ctx.lang,
	});
	return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}
