import { Size, Sprite, sys, UITransform, Vec2 } from "cc";
import { MapData, MapEditor } from "./MapEditor";
import { MapManager } from "./MapManager";
import { MapModel } from "../../../scripts/Model/MapModel";
import { Utils } from "../../../scripts/Utils/Utils";

export class MapLoadMap {
    public static loadMapData(map: MapData , mapEditor : MapEditor) {
        const manager = MapManager.GetInstance();

        mapEditor.allMapAssetsData = map;
        mapEditor.clearWalkableDebugOverlay();
        mapEditor.clearNpcTileDebugOverlay();

        //马路
        for (let i = 0; i < mapEditor.allMapAssetsData.Ground.length; i++) {
            let ground = mapEditor.allMapAssetsData.Ground[i];
            let gridPos = new Vec2(parseInt(ground.position.split(',')[0]), parseInt(ground.position.split(',')[1]))

            MapModel.getInstance().setMapGround(MapManager.GetInstance().getGroundAssetsStr()[ground.cfgId], 0 , mapEditor);
            mapEditor.placeholderTilemap.set(ground.position, { _type: 2, empty: false, _tileType: parseInt(ground.id) , cfgId : ground.cfgId});
            mapEditor.setDisplayTile(gridPos, new Size(mapEditor.tileSize, mapEditor.tileSize), parseInt(ground.id));
        }

        //树
        for (let i = 0; i < mapEditor.allMapAssetsData.Plant.length; i++) {
            let plant = mapEditor.allMapAssetsData.Plant[i];
            let pos = new Vec2(parseInt(plant.position.split(',')[0]), parseInt(plant.position.split(',')[1]));

            let idAry = plant.id.split("#")
            const tile = MapManager.GetInstance().getMapCurTileNode(idAry[0] , idAry[1]);
            let size = tile.getComponent(UITransform).contentSize;
            const buildingSize = MapModel.getInstance().getBuildingSize(size , mapEditor);
            
            const worldPos = MapModel.getInstance().gridToWorld(pos , size , mapEditor);
            tile.setPosition(worldPos);
            mapEditor.mapContainer.addChild(tile);

            mapEditor.mapItems.set(`${pos.x},${pos.y}`, { id: idAry[0] + "#" + idAry[1], tile: tile, tileType: "Plant" });

            // 更新网格数据
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = pos.x + x;
                    const gridY = pos.y - y;
                    if (y == 2) {
                        mapEditor.mapData[gridX][gridY] = 0;
                    } else {
                        mapEditor.mapData[gridX][gridY] = 2;
                    }
                }
            }
        }

        mapEditor.loadHourse();
        mapEditor.renderWalkableDebugOverlay(map?.Walkable?.cells);
    }
}