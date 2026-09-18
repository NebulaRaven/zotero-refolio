  // src/features/item-tree/itemTreeRenderPatch.ts
  export function installItemTreeRenderPatch(prototype, patches, isEnabled, onError: (error: unknown) => void = () => {}) {
    const originalRenderCell = prototype._renderCell;
    const patchedRenderCell = function (index, data, column, isFirstColumn) {
      const cell = originalRenderCell.call(this, index, data, column, isFirstColumn);
      const patch2 = patches.find(({
        key
      }) => key === column?.dataKey);
      if (!patch2) {
        return cell;
      }
      try {
        if (!isEnabled()) {
          return cell;
        }
        return patch2.renderCell(cell, index, this.getRow?.(index)?.ref);
      } catch (error) {
        try {
          onError(error);
        } catch {}
        return cell;
      }
    };
    prototype._renderCell = patchedRenderCell;
    let installed = true;
    return () => {
      if (!installed) {
        return;
      }
      installed = false;
      if (prototype._renderCell === patchedRenderCell) {
        prototype._renderCell = originalRenderCell;
      }
    };
  }

