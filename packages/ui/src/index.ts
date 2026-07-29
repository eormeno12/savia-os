// @savia-os/ui — shared design system, organized by Brad Frost's Atomic Design.
// Consumed by apps/app and apps/landing via transpilePackages (barrel import only).
//
//   foundations → sub-atomic brand values (mirror of @savia-os/design-tokens)
//   atoms       → indivisible primitives (no other project component inside)
//   molecules   → a few atoms doing one job
//   organisms   → self-contained sections composing molecules/atoms
//   templates   → page-level layout skeletons with content slots
//   (pages live in each app under src/app — not in the shared library)
//
// System entry (SaviaProvider) + the FadeInUp motion utility sit outside the
// tier hierarchy because they are not rendered UI components.

// ---------- System ----------
export { SaviaProvider } from "./provider";

// ---------- Foundations (sub-atomic) ----------
export { BRAND_COLORS, EASE_SAVIA } from "./foundations/constants";

// ---------- Motion utilities ----------
export { FadeInUp } from "./motion/fade-in-up";

// ---------- Atoms ----------
export { SaviaMark } from "./atoms/savia-mark";
export { Button, LinkButton } from "./atoms/button";
export type { LinkButtonProps } from "./atoms/button";
export { Card } from "./atoms/card";
export type { CardProps } from "./atoms/card";
export { Avatar, AvatarGroup } from "./atoms/avatar";
export type { AvatarProps } from "./atoms/avatar";
export { ProgressBar } from "./atoms/progress-bar";
export type { ProgressBarProps } from "./atoms/progress-bar";
export { Skeleton, SkeletonText, CardSkeleton } from "./atoms/skeleton";
export type { CardSkeletonProps } from "./atoms/skeleton";
export { StatusBadge } from "./atoms/status-badge";
export type { StatusBadgeProps, StatusTone } from "./atoms/status-badge";
export { MetricStat } from "./atoms/metric-stat";
export type { MetricStatProps } from "./atoms/metric-stat";
export { NavItem } from "./atoms/nav-item";
export {
  PageTitle,
  SectionTitle,
  CardTitle,
  Metric,
  Caption,
  Eyebrow,
} from "./atoms/typography";

// ---------- Molecules ----------
export { Field } from "./molecules/field";
export type { FieldProps } from "./molecules/field";
export { OtpInput } from "./molecules/otp-input";
export type { OtpInputProps } from "./molecules/otp-input";
export { CopyBlock } from "./molecules/copy-block";
export type { CopyBlockProps } from "./molecules/copy-block";
export { Dialog } from "./molecules/dialog";
export type { DialogProps } from "./molecules/dialog";
export { EmptyState } from "./molecules/empty-state";
export type { EmptyStateProps } from "./molecules/empty-state";
export { SearchBar } from "./molecules/search-bar";
export type { SearchBarProps } from "./molecules/search-bar";
export { DropZone } from "./molecules/drop-zone";
export type { DropZoneProps } from "./molecules/drop-zone";
export { Stepper } from "./molecules/stepper";
export type { StepperProps, StepperItem } from "./molecules/stepper";
export { SectionHeader } from "./molecules/section-header";
export { Toaster, toaster, notify } from "./molecules/toaster";

// ---------- Organisms ----------
export { CommandPalette } from "./organisms/command-palette";
export type { CommandPaletteProps, CommandItem } from "./organisms/command-palette";
export { ConfirmDialog } from "./organisms/confirm-dialog";
export type { ConfirmDialogProps } from "./organisms/confirm-dialog";
export { SaviaParticles } from "./organisms/savia-particles";

// ---------- Templates ----------
export { Shell } from "./templates/shell";
export type { ShellProps, ShellTone } from "./templates/shell";
