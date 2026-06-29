# 工坊系统 — 客户端对接文档

> 服务端：Nakama RPC（需已登录 Session）  
> 配置表：`workshopLevel.json` / `workshopBranch.json` / `workshopCategory.json` / `workshopRecipe.json`  
> 最后更新：与当前 `miniwo_nakama/internal/module/workshop` 实现一致

---

## 1. 概述

工坊允许玩家：

1. **建造 / 升级**工坊建筑  
2. **选择分支**（普通 / 科学 / 魔法）  
3. **派遣 NPC** 到槽位（缩短时间、提高产出倍数）  
4. 消耗**图纸 + 材料**进行制作  
5. 倒计时结束后**判定成败**，再**领取产物**

每个品类（食物 / 药品 / 礼物）**同时只能有 1 个制作队列**。

---

## 2. 通用约定

### 2.1 RPC 调用

- 所有接口通过 Nakama `rpc(id, payload)` 调用，`payload` 为 JSON 字符串  
- 需有效 Session（`game_login` 之后）  
- `player_id` 由服务端从 Nakama 账号 metadata 解析，**客户端无需传**

### 2.2 响应格式

**成功：**

```json
{
  "success": true,
  "workshop": { ... },
  ...
}
```

**失败：**

```json
{
  "success": false,
  "message": "错误英文描述"
}
```

HTTP/RPC 层仍返回 200；以 `success` 字段判断业务成败。

### 2.3 时间戳

- `started_at` / `finish_at` / `obtained_at`：**Unix 秒**  
- `remain_sec`：剩余秒数，服务端实时计算

### 2.4 道具数量格式

配置与服务端内部使用 `itemId#count|itemId#count`；**RPC 返回给客户端的 `materials` 已解析为数组**：

```json
{ "item_id": 104, "count": 50 }
```

---

## 3. 枚举

### 3.1 工坊等级 `level`

| 值 | 说明 |
|----|------|
| 0 | 未建造 |
| 1–4 | 初级 → 大师（见配置 `workshopLevel.json`） |

### 3.2 分支 `branch`

| 值 | 说明 |
|----|------|
| 0 | 普通 |
| 1 | 科学 |
| 2 | 魔法 |

首次选分支用 `workshop_choose_branch`；之后切换用 `workshop_change_branch`（会降级并扣费）。

### 3.3 品类 `category`

| 值 | 名称 |
|----|------|
| 1 | 食物 |
| 2 | 药品 |
| 3 | 礼物 |

`jobs_by_category` 的 key 即品类 ID，无任务时为 `null`。

### 3.4 制作任务状态 `job.status`

| 值 | 常量 | 说明 |
|----|------|------|
| 0 | Crafting | 制作中（倒计时进行中） |
| 1 | Ready | 倒计时结束；未判定或已判定待领取 |
| 2 | Claimed | 已领取（不再出现在 `jobs_by_category`） |
| 3 | Canceled | 已取消 |

### 3.5 制作成败 `job.craft_success`

| 值 | 说明 |
|----|------|
| 字段不存在 | 尚未调用 `workshop_craft_result` |
| 0 | 失败 |
| 1 | 成功 |

### 3.6 图纸类型 `recipe.recipe_type`

| 值 | 说明 |
|----|------|
| 1 | 官方图纸 |
| 2 | 用户自定义（预留 AI 等） |

### 3.7 NPC 工作状态（miniwoedit，派农场/回家相关）

| 值 | 说明 |
|----|------|
| 0 | 闲置 / 回家 |
| 1 | 农场工作 |
| 5 | 工坊工作 |

派遣进工坊槽位后 NPC 为 **5**；卸下后为 **0**。  
在工坊中的 NPC **不能**通过 miniwoedit 的 `/api/npc/work_status/batch` 派农场或回家（英文错误：`NPC is working in the workshop`）。

---

## 4. 图纸（Blueprint）

### 4.1 获得方式

- **首次 `game_login`**：自动发放全部官方图纸，每种 **`count = 1`**（仅一次，metadata 标记 `official_recipe_granted`）  
- 后续可通过活动 / AI 等扩展（写入 `user_workshop_recipe`）

### 4.2 消耗规则

- **开始制作**（`workshop_start_craft`）：立即扣除 `materials` 材料，并推送背包更新（code 101）
- **领取产物**（`workshop_collect`）：扣除 **1 张**图纸（成功 / 失败都扣）
- **取消制作**（`workshop_cancel`）：**不退材料**，**不扣图纸**

### 4.3 `workshop_info` 中的 `recipes`

返回玩家**拥有且 count > 0** 的图纸列表（不是全量配置表）。

| 字段 | 类型 | 说明 |
|------|------|------|
| recipe_id | int | 图纸 ID |
| recipe_type | int | 1 官方 / 2 自定义 |
| count | int | **持有数量** |
| category | int | 品类 |
| name_cn | string | 名称 |
| output_item_id | int | 成功产出道具 ID |
| batch_output_count | int | 基础产出数量 |
| fail_output_item_id | int | 失败产出道具 ID |
| fail_batch_output_count | int | 失败产出数量 |
| materials | array | 消耗材料 |
| craft_time_sec | int | 基准制作秒数 |
| npc_stamina_cost | int | 每个槽位 NPC 体力消耗 |
| success_rate | int | 成功率（**万分比**，9000 = 90%） |
| required_workshop_level | int | 所需工坊等级 |
| required_branch | int | 所需分支（0=不限） |
| allow_cancel | bool | 是否可取消 |
| locked | bool | 当前是否因等级/分支不可制作 |
| lock_reason | string | 锁定原因（英文） |
| source | string | 获得途径，如 `official_grant` |
| info | object | 玩家图纸扩展信息（JSON，无则为空） |
| obtained_at | int64 | 获得时间（秒） |

---

## 5. WorkshopState 结构

多数 RPC 成功时返回 `workshop` 对象：

```json
{
  "player_id": 12345,
  "level": 2,
  "branch": 1,
  "map_level": 5,
  "npc_slots": [
    { "slot_index": 0, "npc_id": 1001 }
  ],
  "jobs_by_category": {
    "1": { ...JobView },
    "2": null,
    "3": null
  },
  "recipes": [ ...RecipeView ],
  "categories": [
    { "id": 1, "name_cn": "食物", "sort": 1, "busy": true }
  ]
}
```

| 字段 | 说明 |
|------|------|
| map_level | 玩家地图等级（建造/升级前置） |
| npc_slots | 已派遣 NPC 槽位 |
| jobs_by_category | 三个品类当前任务，无则为 null |
| recipes | 仅 `workshop_info` 等带配方接口返回；推送 `CodeWorkshop` **不含** recipes |
| categories | 品类 busy 状态 |

### JobView 主要字段

| 字段 | 说明 |
|------|------|
| job_id | 任务 ID（后续判定/领取/取消用） |
| recipe_id | 图纸 ID |
| remain_sec | 剩余秒数，0 表示可判定 |
| output_multi | 产出倍数（开始制作时随机） |
| final_output_count | 成功时预览数量 = batch_output_count × output_multi |
| craft_success | 判定后才有；见 3.5 |
| reward_item_id / reward_count | 判定后可领道具预览 |
| fail_output_item_id / fail_output_count | 失败时预览 |
| npc_ids | 参与本次制作的 NPC |

---

## 6. RPC 接口一览

| RPC | 请求 body | 额外返回字段 | 说明 |
|-----|-----------|--------------|------|
| `workshop_info` | `{}` | — | 全量状态 + recipes |
| `workshop_build` | `{}` | — | 建造 1 级工坊 |
| `workshop_upgrade` | `{}` | — | 升 1 级 |
| `workshop_choose_branch` | `{ "branch": 1 }` | — | 首次选分支 |
| `workshop_change_branch` | `{ "branch": 2 }` | — | 切换分支 |
| `workshop_assign_npc` | `{ "slot_index": 0, "npc_id": 1001 }` | — | 派遣 NPC |
| `workshop_unassign_npc` | `{ "slot_index": 0 }` | — | 卸下 NPC |
| `workshop_start_craft` | `{ "recipe_id": 10001 }` | — | 开始制作 |
| `workshop_craft_result` | `{ "job_id": 123 }` | `success`, `job_id` | 倒计时结束后判定 |
| `workshop_collect` | `{ "job_id": 123 }` | `rewards`, `job_id` | 领取产物 |
| `workshop_claim` | 同 collect | 同 collect | 与 collect 等价 |
| `workshop_cancel` | `{ "job_id": 123 }` | — | 取消制作中任务 |

> 除 `workshop_info` 外，多数接口返回的 `workshop.recipes` 为空（未带配方列表）。

---

## 7. 制作流程（客户端必接）

```
┌─────────────────┐
│ workshop_info   │  进入工坊页，展示图纸、队列、NPC
└────────┬────────┘
         ▼
┌─────────────────┐
│ start_craft     │  扣材料 + NPC 体力；jobs_by_category[category] 有任务
└────────┬────────┘
         ▼  本地倒计时 remain_sec → 0
┌─────────────────┐
│ craft_result    │  服务端掷成功率；返回 success=true/false
└────────┬────────┘       job.craft_success = 1 或 0
         ▼
┌─────────────────┐
│ collect / claim │  发产物到背包；图纸 count - 1
└─────────────────┘
```

### 7.1 判定时机

- 仅当 `job.status === 1` 且 `remain_sec === 0` 时可调用 `workshop_craft_result`  
- 若 `craft_success` 已有值，重复调用返回相同结果（幂等）

### 7.2 领取时机

- 必须先 `craft_result`（`craft_success` 非空）  
- 再调用 `workshop_collect`  
- 背包满返回 `bag full`

### 7.3 取消

- 仅 `status === 0`（制作中）可取消  
- 需配方 `allow_cancel === true`  
- **材料已在开始制作时扣除，取消不退还**  
- **不扣图纸**（图纸仅在领取时扣除）

---

## 8. 建造 / 升级 / 分支

### 8.1 建造 `workshop_build`

- 前置：`level === 0`，地图等级 ≥ 配置 `required_map_level`  
- 消耗：1 级 `build_items`（如 `104#200` 金币）  
- 成功后 `level = 1`

### 8.2 升级 `workshop_upgrade`

- 前置：已建造，地图等级满足下一级要求  
- 消耗：下一级 `upgrade_items`  
- 2 级起解锁 NPC 槽位（见下表）

| 工坊等级 | NPC 槽位 | 时间减免上限 | 说明 |
|----------|----------|--------------|------|
| 1 | 0 | 无 | 派 NPC 无加速 |
| 2 | 1 | 50% | |
| 3 | 2 | 75% | 3 级可选非普通分支 |
| 4 | 3 | 75% | |

### 8.3 分支

- **首次**：`workshop_choose_branch`，从普通(0) 选 科学(1) 或 魔法(2)  
- **切换**：`workshop_change_branch`，消耗 `switch_cost_items`，工坊**降级**到 `rollback_workshop_level`  
- 切换时**不能有进行中的制作**

### 8.4 锁定规则

图纸 `locked === true` 当：

- `required_workshop_level > 当前工坊等级`，或  
- `required_branch != 0` 且与当前分支不一致  

锁定图纸不可 `start_craft`（服务端返回 `recipe locked`）。

---

## 9. NPC 派遣

### 9.1 派遣 `workshop_assign_npc`

- `slot_index`：0 起，须 < 当前等级 `npc_slot_count`  
- NPC 须属于玩家，`work_status === 0`（休息）  
- 探索中、已在其他槽位不可派遣  
- 成功后 NPC `work_status = 5`（工坊）

### 9.2 卸下 `workshop_unassign_npc`

- NPC `work_status` 恢复为 0

### 9.3 对制作的影响

- **时间**：NPC 制作技能（属性 ID **207**）越高，时间越短（2 级工坊起生效）  
- **产出倍数**：提高 `output_multi_rules` 高倍率权重  
- **体力**：开始制作时，**每个槽位 NPC** 各扣 `npc_stamina_cost`  
- **成功率**：不受 NPC 影响

实际时间公式（客户端展示可近似）：

```
实际秒数 = craft_time_sec × (1 - min(Σ有效技能/1000, 上限))
上限 = time_reduce_cap / 10000
```

---

## 10. 服务端推送

监听 Nakama Notification，`content` 为 JSON。

| code | 名称 | 内容 |
|------|------|------|
| **114** | CodeWorkshop | `{ "workshop": WorkshopState }`（通常无 recipes） |
| **101** | CodeBagUpdate | 背包变更（开始扣材料、领取产物等） |
| **115** | CodeItemObtain | `{ "source": "workshop_collect", "items": [...] }` |

建议在收到 **114** 时刷新工坊 UI；收到 **115** 时播放获得道具表现。

---

## 11. 常见错误 message

| message | 场景 |
|---------|------|
| not login | 未登录 |
| invalid player_id | 账号未绑定 player_id |
| workshop not built | 未建造 |
| workshop already built | 重复建造 |
| map level N required, have M | 地图等级不足 |
| items not enough | 材料不足 |
| stamina not enough | NPC 体力不足 |
| recipe not owned | 无此图纸 |
| recipe blueprint not enough | 图纸 count = 0 |
| recipe locked | 等级/分支不满足 |
| category busy | 该品类已有队列 |
| npc must be resting | 派遣时 NPC 非休息状态 |
| npc is exploring | 探索中 |
| craft not finished | 未到判定时间 |
| craft result not resolved | 未判定就领取 |
| job not ready to collect | 状态不对 |
| bag full | 背包满（领取产物时） |
| only crafting job can be canceled | 非制作中不可取消 |
| recipe cannot be canceled | 配方禁止取消 |
| cannot change branch while crafting | 有任务时不可换分支 |

---

## 12. 客户端 UI 建议

1. **工坊主页**：`workshop_info` 拉全量；监听 code 114  
2. **图纸列表**：用 `recipes`，展示 `count`；`locked` 灰显并显示 `lock_reason`  
3. **制作中**：读 `jobs_by_category[category]`，用 `remain_sec` 做倒计时  
4. **倒计时结束**：调 `workshop_craft_result`，用返回的 `success` 播成功/失败表现  
5. **领取按钮**：调 `workshop_collect`，用 `rewards` + code 115 更新背包  
6. **NPC 页**：与 miniwoedit 的 work_status 联动；工坊中显示状态 5，禁止派农场

---

## 13. 示例

### 13.1 查询工坊

```json
// Request: workshop_info
{}

// Response
{
  "success": true,
  "workshop": {
    "player_id": 10001,
    "level": 2,
    "branch": 0,
    "map_level": 4,
    "npc_slots": [],
    "jobs_by_category": { "1": null, "2": null, "3": null },
    "recipes": [
      {
        "recipe_id": 10001,
        "recipe_type": 1,
        "count": 1,
        "category": 1,
        "name_cn": "简易面包",
        "materials": [{ "item_id": 100041, "count": 20 }],
        "craft_time_sec": 60,
        "success_rate": 9000,
        "locked": false
      }
    ],
    "categories": [
      { "id": 1, "name_cn": "食物", "sort": 1, "busy": false }
    ]
  }
}
```

### 13.2 开始 → 判定 → 领取

```json
// 1. workshop_start_craft
{ "recipe_id": 10001 }

// 2. remain_sec === 0 后 workshop_craft_result
{ "job_id": 1717000000123 }
// Response: { "success": true, "success": true, "job_id": 1717000000123, "workshop": {...} }
// 注意：外层 success=RPC成功，内层 success=制作是否成功

// 3. workshop_collect
{ "job_id": 1717000000123 }
// Response:
{
  "success": true,
  "job_id": 1717000000123,
  "rewards": [{ "item_id": 110001001, "count": 6 }],
  "workshop": { "recipes": [{ "recipe_id": 10001, "count": 0, ... }] }
}
```

---

## 14. 相关服务端文件（供联调）

| 路径 | 说明 |
|------|------|
| `miniwo_nakama/internal/module/workshop/rpc.go` | RPC 注册 |
| `miniwo_nakama/internal/module/workshop/service.go` | 业务逻辑 |
| `miniwo_nakama/internal/module/workshop/model.go` | 返回结构 |
| `miniwo_nakama/internal/config/workshop*.json` | 静态配置 |
| `miniwoedit/handler/npcWorkStatusHandler.go` | NPC 派农场/回家（与工坊互斥） |

配置热更新：Nakama 启动时会从 `配置/output/server/*.json` 同步到 `internal/config`；**图纸配置表**首次启动写入 MySQL `workshop_recipe`。

---

## 15. FAQ

**Q：未建造工坊能制作吗？**  
A：不能，`start_craft` 要求 `level > 0`。

**Q：登录就有图纸，为什么还要建造？**  
A：图纸与工坊建筑独立；有图纸但 `level=0` 仍无法制作。

**Q：`workshop_claim` 和 `workshop_collect` 区别？**  
A：无区别，任选其一。

**Q：制作失败还扣图纸吗？**  
A：扣。领取时无论成败都 `count - 1`。

**Q：推送里的 workshop 没有 recipes 怎么办？**  
A：需要配方列表时主动调 `workshop_info`。
