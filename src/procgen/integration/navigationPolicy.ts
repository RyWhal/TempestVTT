import type { Map } from '../../types';

export type LaunchBookFocus =
  | { kind: 'section'; id: string }
  | { kind: 'preview'; id: string }
  | null;

export const shouldPersistActiveMapSelection = (map: Pick<Map, 'sourceType'> | null) =>
  map?.sourceType !== 'generated';

export const resolveLaunchSectionId = ({
  activeSectionId,
}: {
  activeSectionId: string | null;
}) => {
  return activeSectionId;
};
