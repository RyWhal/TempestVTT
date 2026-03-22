import type { Map } from '../../types';
import type { GeneratedSection, SectionRenderPayload } from '../types';
import { buildSectionRenderPayload } from '../map/buildSectionRenderPayload';

interface CreateGeneratedMapInput {
  mapId: string;
  sessionId: string;
  section: GeneratedSection;
  tileSizePx?: number;
  name?: string;
}

type PartialSectionRenderPayload =
  Pick<SectionRenderPayload, 'width' | 'height' | 'tileSizePx' | 'backgroundColor' | 'floors' | 'walls' | 'markers'> &
  Partial<SectionRenderPayload>;

export const normalizeSectionRenderPayload = (
  payload: PartialSectionRenderPayload
): SectionRenderPayload => ({
  ...payload,
  doors: payload.doors ?? [],
  hazards: payload.hazards ?? [],
  objects: payload.objects ?? [],
  atmosphere: payload.atmosphere ?? null,
});

export const createGeneratedMapFromSection = ({
  mapId,
  sessionId,
  section,
  tileSizePx,
  name,
}: CreateGeneratedMapInput): Map => {
  const renderPayload = normalizeSectionRenderPayload(
    buildSectionRenderPayload(section, tileSizePx)
  );

  return {
    id: mapId,
    sessionId,
    sourceType: 'generated',
    generatedSectionId: section.sectionId,
    generatedRenderPayload: renderPayload,
    name: name ?? section.sectionId,
    imageUrl: '',
    width: renderPayload.width,
    height: renderPayload.height,
    sortOrder: 0,
    createdAt: new Date(0).toISOString(),
    gridEnabled: true,
    gridOffsetX: 0,
    gridOffsetY: 0,
    gridCellSize: renderPayload.tileSizePx,
    gridColor: 'rgba(255,255,255,0.14)',
    fogEnabled: true,
    fogDefaultState: 'fogged',
    fogData: [],
    drawingData: [],
    effectsEnabled: false,
    effectData: [],
    showPlayerTokens: true,
  };
};
