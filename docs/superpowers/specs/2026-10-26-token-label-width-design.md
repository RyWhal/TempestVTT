# Minimum token name width

User approved implementation on October 26, 2026. The token label currently uses the greater of token diameter and 1.8 grid cells, with a fixed 12px font. On small grids the label can truncate even short names such as Tama.

Set label width to `Math.max(80, pixelSize, gridCellSize * 1.8)` and center it using `(pixelSize - labelWidth) / 2`. Keep font size, vertical position, ellipsis, wrapping, body size, zoom behavior, and persistence unchanged. This is a label box minimum in map coordinates, not a fixed screen-size label or collision-avoidance feature. Dense groups can still overlap; long labels still truncate.

Verify real canvas text for Tama on tiny grids and tiny tokens, with token-size overrides on/off and zoom at 50%, 100%, and 193%. Check large tokens and long names retain centering and ellipsis. No schema changes or deployment are included.
