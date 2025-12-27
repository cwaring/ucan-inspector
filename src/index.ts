/**
 * Library entrypoint.
 *
 * @remarks
 * Re-exports the inspector component plus selected helper utilities and types.
 */
export * from './components/UcanInspector'
export { getMockToken, getMockTokens } from './utils/mockData'
export type { AnalysisReport, Issue, IssueLevel, SignatureInsight, SignatureStatus, TokenAnalysis } from './utils/ucanAnalysis'
export type { ContainerDiagnostic, ContainerDiagnosticLevel, ContainerParseError, ContainerParseResult } from './utils/ucanContainer'
export { getInspectorVersion } from './utils/version'
