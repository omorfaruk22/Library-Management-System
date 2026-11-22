/**
 * Backwards-compatible barrel for the design system.
 * New code imports from `../ui/primitives` (and `../ui/layout` for chrome);
 * older screens still import from here, and both resolve to the same
 * implementation so styles never drift apart.
 */
export {
  Alert, Badge, Button, Card, CoverCard, EmptyState, FieldShell, FormActions, IconButton, Input, Modal,
  PageTitle, Pagination, SectionHeading, SegmentedControl, Select, Skeleton, SkeletonRows, Spinner,
  StatCard, TableShell, Textarea, Toolbar,
} from './ui/primitives'
export { Layout, Header, Footer, Brand } from './ui/layout'
