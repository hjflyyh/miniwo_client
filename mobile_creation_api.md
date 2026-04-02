# 手机端复刻「官方完整创作流程」接口文档（miniwoedit）

本文档用于把管理端 `official-creation.html` 的完整创作流程 UI 复刻到手机端时，快速对齐 **请求路径、参数、返回结构**，并标注关键注意事项（例如：部分 AI 接口返回不是 `{success,data}` 包装）。

## 背景与基本约定

### 1. 后端是谁

管理端完整创作流程（`dist/miniwo_admin/js/official-creation.js`）请求的服务是 **edit 后端**：`miniwoedit`（Gin，默认 `http://127.0.0.1:8080`）。

路由注册位置：`miniwoedit/main.go`。

### 2. 统一鉴权字段

大多数接口都要求 `token`：

- `token`: 登录后由 edit 后端签发（并存本地）。
- `mapId`: 地图 ID（int64）。

### 3. 通用错误返回

大量 handler 在出错时直接返回：

```json
{ "error": "错误原因" }
```

并且 HTTP 状态码通常为 4xx/5xx。你的客户端 `sendPostHttp` 里目前是判断 `data.success`，因此**需要兼容**这种错误结构（例如把 `error`/`message`/非 200 都转成 toast）。

### 4. 两种“成功返回壳”

#### A) 保存/查询类：`{ success: true, data: {...} }`

例如 `/getMap`、`/saveMapTitle`、`/saveMapWorldview`、`/saveMapData` 等。

#### B) AI 转发类：**常见为“直接透传 AI JSON”**

例如 `/generateWorldviewByAI`、`/generateStoryOutlineByAI`：edit 后端把 AI 服务的 JSON 响应 **原样**返回（不包 `success/data`）。

> 例外：`/generateCardStoryPreview`、`/generateCardStoryAndSave` 是 edit 后端自定义的 `{success:true,data:{request_payload, ai_response}}`。

---

## 1）查看已编辑地图：按 mapId 拉取地图数据

### 接口

- **POST** `/getMap`
- **body**

```json
{ "token": "xxx", "mapId": 123 }
```

对应入参结构：`miniwoedit/model/request.go` 的 `GetMapRequest`。

### 成功返回

```json
{
  "success": true,
  "data": {
    "map_id": 123,
    "player_id": 456,
    "cmd": "...",
    "map": { "...": "..." }
  }
}
```

### `data.map`（重点字段说明）

`data.map` 来自 `miniwoedit/handler/mapHandler.go:getMap(mapID)`，字段（核心）：

- `id` (int64): mapId
- `player_id` (int64)
- `map_title` (int)
- `map_name` (string)
- `map_era` (int)
- `map_worldview` (string)
- `map_restriction` (string)
- `map_story_title` (string)
- `map_story_info` (string)
- `map_state` (int)
- `map_like_count` (int64)
- `map_cover_url` (string)
- `map_data` (string)
- **`map_npc` (string)**：NPC ID 列表的 **JSON 字符串**（例如 `"[1,2,3]"`），不是数组；若库里为 NULL，则为 `""`
- `created_at` / `updated_at`（时间）

#### `map_npc` 与 NPC 详情结构

- 在 `getMap` 返回的 `map` 对象中，**只有 `map_npc`，没有 NPC 详情列表**。
- `map_npc` 是一个 **字符串**：
  - 有 NPC 时：形如 `"[1,2,3]"`，表示 NPC 的 `id` 列表；
  - 无 NPC / 字段为 NULL 时：返回 `""`（空字符串）。
- 如果你需要 NPC 的完整信息（名字、人设等），应调用 **`/getNpcByMap`**。

`/getNpcByMap` 的核心返回结构如下（`miniwoedit/handler/npcHandler.go:GetNpcByMap`）：

- **成功返回壳**：

```json
{
  "success": true,
  "data": {
    "map_id": 123,
    "player_id": 456,
    "npc_list": [ /* NPC 对象数组 */ ]
  }
}
```

- `npc_list` 元素结构（单个 NPC）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | NPC 主键 ID（与 `map_npc` 里的 ID 对应） |
| `name` | string | 名字 |
| `mbti` | number | MBTI 类型（枚举值） |
| `sex` | number | 性别枚举 |
| `age` | number | 年龄 |
| `characteristics` | string | 性格特征 |
| `hobbies` | string | 兴趣爱好 |
| `past_experiences` | string | 过去经历 |
| `identity` | string | 身份设定（职业/角色定位等） |
| `model_url` | string | 立绘/模型图 URL |
| `npc_avatar_url` | string | 头像 URL（可能为空字符串） |
| `npc_sprite_url` | string | 像素小人/行走图 URL（可能为空字符串） |
| `info` | string | 额外说明/人设补充（可能由 AI 填充） |
| `appearance` | string | 外貌描述 |
| `story` | string | 角色背景故事 |
| `is_saved` | number | 是否已保存/确认（0/1 等） |

**无 NPC 时**：`npc_list` 为 `[]`（空数组），不会是 `null`。

### 附带聚合数据：`map_story` / `daily_story` / `map_card_master`

`getMap` 在组装 `data.map` 时，会调用 `getMapStory`、`getDailyStory`、`getMapCardMaster`（见 `miniwoedit/handler/mapHandler.go:getMap`）。**只有函数返回值非 `nil` 时，才会把对应 key 写进 `map` 对象**；若返回 `nil`，则 **JSON 里不会出现该字段**（不是 `null`，也不是空对象）。

下面说明每种聚合数据的**结构**，以及**不存在 / 空数据**时在接口里的表现。

---

#### `map_story`（表 `map_story`）

| 情况 | 行为 |
|------|------|
| 该 `map_id` 在 `map_story` 中**没有行** | `getMapStory` 返回 `nil` → **`map` 对象中不包含 `map_story` 字段** |
| 有行 | 返回对象，见下表 |

**有数据时的字段**（`miniwoedit/handler/storyHandler.go:getMapStory`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | `map_story` 表主键 |
| `map_id` | number | 当前地图 ID |
| `story_tag` | number | 剧情标签 ID（对应 tag） |
| `story_outline` | string | 故事大纲；库中为 NULL 或未写入时，接口里为 **`""`** |
| `map_info` | string | 地图信息（一般为 **JSON 字符串**，前端需自行 `JSON.parse`）；库中为 NULL 时，接口里为 **`""`** |
| `created_at` | string（时间） | 有则出现 |
| `updated_at` | string（时间） | 有则出现 |

---

#### `daily_story`（表 `map_daily_story`）

| 情况 | 行为 |
|------|------|
| 该 `map_id` 在 `map_daily_story` 中**没有行** | `getDailyStory` 返回 `nil` → **`map` 对象中不包含 `daily_story` 字段** |
| 有行 | 返回对象，见下表 |

**有数据时的字段**（`miniwoedit/handler/dailyStoryHandler.go:getDailyStory`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | `map_daily_story` 表主键 |
| `map_id` | number | 当前地图 ID |
| `total_days` | number | 总天数 |
| `days` | **string** | **存的是 JSON 文本**，不是数组。库中 `days` 为 NULL 时，接口里固定为 **`"[]"`**（四个字符的字符串，表示空数组的 JSON）；有内容时为 JSON 数组字符串，解析后每项大致为 `{ "day": number, "npc_id": number, "description": string }`（与生成/保存逻辑一致） |
| `created_at` | string（时间） | 有则出现 |
| `updated_at` | string（时间） | 有则出现 |

手机端建议：对 `daily_story.days` 先判断类型，再 `JSON.parse(days)` 得到数组。

---

#### `map_card_master`（来自表 `card_master` + 碎片状态 `card_master_suipian`）

| 情况 | 行为 |
|------|------|
| 查询 `card_master` **失败**或扫描行 **失败** | `getMapCardMaster` 返回 `nil` → **`map` 对象中不包含 `map_card_master` 字段**（异常情况） |
| 查询成功但**没有任何卡牌行** | 返回**非 nil** 对象 → **字段存在**，见下表（`total_cards` 为 `0`，`cards` 为空数组） |

**结构**（`miniwoedit/handler/cardCopyHandler.go:getMapCardMaster`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `map_id` | number | 当前地图 ID |
| `total_cards` | number | 等于 `cards.length` |
| `cards` | array | 每张卡一张对象，见下表 |

**单张 `cards[]` 元素**（`scanCardMasterRows` + `attachCardFragmentGenerationStatus`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string 或 number | 若库里有 `source_card_id`，会覆盖为 **字符串**形式的业务卡 ID；否则为 `card_master.id`（number） |
| `master_id` | number | 表 `card_master.id` |
| `source_card_id` | string | 业务侧卡牌 ID |
| `day` | number | 默认 `1` |
| `card_name` | string | 可能为 `""` |
| `rarity` | string | 默认 `"N"` |
| `art_url` | string | 可能为 `""` |
| `story` / `content` | string | 文案一致时两者相同 |
| `fragment_ids` | number[] | 碎片 ID 列表；无解析结果时为 `[]` |
| `fragment_status_map` | object | key 为碎片 ID 字符串，value 为生成状态（`0`/`1` 等） |
| `fragments_detail` | array | 每个碎片的详情对象，含 `id`、`idx`、`generated`、`help_text`、`story_detail`、`idle_lines`、`trigger_time`、`fragment_desc` 等 |
| `generated_fragment_count` | number | 已生成碎片数 |
| `total_fragment_count` | number | 碎片总数 |
| `all_fragments_generated` | boolean | 是否全部已生成 |
| `created_at` / `updated_at` | string（时间） | 有则出现 |

**无卡牌时**：`map_card_master` 仍存在（只要查询成功），形如：

```json
{
  "map_id": 123,
  "total_cards": 0,
  "cards": []
}
```

---

## 2）完整创作流程接口清单（按步骤）

下面按管理端“完整创作流程”的步骤列出手机端需要复刻的接口。除非特别标注，均为：

- **method**: POST
- **headers**: `Content-Type: application/json`
- **body**: JSON

---

## 2.1）按你的 `sendPostHttp(functionName, data)` 写法的调用示例（逐条）

你当前的调用方式是：

```ts
sendPostHttp(functionName, JSON.stringify(payload))
```

下文所有示例都按这个风格输出（`functionName` 不带前导 `/`）。

### 重要提示：AI 透传接口与你的回调不兼容

你的回调只在 `data.success && data.data` 时才 `HttpMessage(data.data)`；但以下接口会 **直接透传 AI JSON**，通常不满足 `success/data`：

- `generateWorldviewByAI`
- `generateStoryOutlineByAI`
- `generateNpcByAI`（更像 AI JSON；虽然后端会做一些 data 规范化/图片处理）

手机端有两种解决方式：

1) **改 `sendPostHttp`**：当返回体里有 `data` 但没有 `success` 时，也当成功派发（例如 `EventSystem.send("HttpMessage", { functionName, raw: data })`）。
2) **为 AI 单独写一个 `sendPostHttpAI`**：不强依赖 `success/data`，直接把原始 JSON 派发出去。

下面我仍然把这些 AI 接口也写成 `sendPostHttp` 的调用示例，便于你统一整理，但你需要按上面做兼容。

### Step 1：创建地图 + 保存标题

#### creatorMap

```ts
this.sendPostHttp(
  "creatorMap",
  JSON.stringify({ token })
)
```

#### saveMapTitle

```ts
this.sendPostHttp(
  "saveMapTitle",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    mapTitle: Number(mapTitle),
    mapName: String(mapName || "")
  })
)
```

### Step 2：世界观保存 + AI 生成世界观

#### saveMapWorldview

```ts
this.sendPostHttp(
  "saveMapWorldview",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    mapWorldview: String(mapWorldview || ""),
    mapRestriction: String(mapRestriction || ""),
    mapEra: Number(mapEra)
  })
)
```

#### generateWorldviewByAI（AI 透传）

```ts
this.sendPostHttp(
  "generateWorldviewByAI",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    worldName: String(worldName || ""),
    worldAttribute: String(worldAttribute || ""),
    eraBackground: String(eraBackground || ""),
    ruleRestriction: String(ruleRestriction || "")
  })
)
```

### Step 3：NPC 增删改查 + AI 生成人设

#### creatorNpc

> 入参字段较多（见 `CreatorNpcRequest`），这里只给最小骨架；你按需要补齐。

```ts
this.sendPostHttp(
  "creatorNpc",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    name: String(name || "")
    // mbti/sex/age/characteristics/hobbies/pastExperiences/identity/modelUrl/avatarUrl/spriteUrl/info/appearance/story...
  })
)
```

**成功返回（示例）**  

大致结构与其他保存类接口一致，为统一壳：

```json
{
  "success": true,
  "data": {
    "map_id": 123,
    "player_id": 456,
    "cmd": "create_npc_success",
    "npc": {
      "id": 999,
      "map_id": 123,
      "name": "新角色名",
      "mbti": "INTJ",
      "sex": "F",
      "age": 18,
      "characteristics": "...",
      "hobbies": "...",
      "past_experiences": "...",
      "identity": "...",
      "model_url": "xxx",
      "avatar_url": "xxx",
      "sprite_url": "xxx",
      "info": "...",
      "appearance": "...",
      "story": "...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

> 实际字段以 `CreatorNpcRequest` / 对应数据库 model 为准；手机端通常只需关心 `data.npc`（新增 NPC）和 `data.map_id`。

#### getNpcByMap

```ts
this.sendPostHttp(
  "getNpcByMap",
  JSON.stringify({ token, mapId: Number(mapId) })
)
```

#### updateNpcById

```ts
this.sendPostHttp(
  "updateNpcById",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    npcId: Number(npcId),
    name: String(name || "")
    // 其余字段同 UpdateNpcRequest
  })
)
```

#### delNpcById

```ts
this.sendPostHttp(
  "delNpcById",
  JSON.stringify({ token, mapId: Number(mapId), npcId: Number(npcId) })
)
```

#### generateNpcByAI（AI 透传/准透传）

```ts
this.sendPostHttp(
  "generateNpcByAI",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    npcId: Number(npcId),
    name: String(name || ""),
    gender: String(gender || ""),
    occupation: String(occupation || ""),
    MBTI: String(MBTI || ""),
    world_setting: String(world_setting || ""),
    special_traits: String(special_traits || ""),
    appearance: String(appearance || ""),
    personality: String(personality || ""),
    backstory: String(backstory || ""),
    hobbies: String(hobbies || "")
  })
)
```

### Step 4：地图编辑保存/清空 + 查询地图数据

#### saveMapData

```ts
this.sendPostHttp(
  "saveMapData",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    mapData: String(mapData || ""),
    base64Image: String(base64Image || "")
  })
)
```

#### deleteEditingMap（仅清空 map_data）

```ts
this.sendPostHttp(
  "deleteEditingMap",
  JSON.stringify({ token, mapId: Number(mapId) })
)
```

#### getMap（用于回填草稿/继续编辑）

```ts
this.sendPostHttp(
  "getMap",
  JSON.stringify({ token, mapId: Number(mapId) })
)
```

### Step 5：故事大纲（AI 透传）

#### generateStoryOutlineByAI（AI 透传）

```ts
this.sendPostHttp(
  "generateStoryOutlineByAI",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    map_info: map_info || { houses: [], items: [], locations: [] },
    npc_list: npc_list || [],
    story_setting: String(story_setting || "")
  })
)
```

### Step 6：每日故事（AI 生成并保存）

#### generateDailyStory

> 该接口入参较多（见 `GenerateDailyStoryRequest`）。最常用的是：`token/mapId/totalDays`，以及可选的 `worldID/confirmedOutline/mapInfo/npcList/dailyCardConfig`。

```ts
this.sendPostHttp(
  "generateDailyStory",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    totalDays: Number(totalDays)
    // worldID/confirmedOutline/mapInfo/npcList/dailyCardConfig...
  })
)
```

### Step 7：卡牌（基础生成/AI 碎片剧情）

#### generateMapCards（创建卡牌基础数据）

```ts
this.sendPostHttp(
  "generateMapCards",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    startDay: Number(startDay || 1),
    endDay: Number(endDay || 14),
    ssrCount: Number(ssrCount || 0),
    srCount: Number(srCount || 0),
    rCount: Number(rCount || 0),
    nCount: Number(nCount || 0),
    includeHelpEvents: !!includeHelpEvents
  })
)
```

#### generateCardStoryPreview（单卡 AI 预览，统一 success/data 壳）

```ts
this.sendPostHttp(
  "generateCardStoryPreview",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    sourceCardId: String(sourceCardId || ""),
    day: Number(day),
    rarity: String(rarity || "N"),
    fragmentIds: fragmentIds || []
  })
)
```

#### generateCardStoryAndSave（单卡 AI 生成并落库，统一 success/data 壳）

```ts
this.sendPostHttp(
  "generateCardStoryAndSave",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    sourceCardId: String(sourceCardId || ""),
    day: Number(day),
    rarity: String(rarity || "N"),
    fragmentIds: fragmentIds || []
  })
)
```

#### updateCardFragmentTriggerTime（更新单个碎片触发时间）

```ts
this.sendPostHttp(
  "updateCardFragmentTriggerTime",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    fragmentId: Number(fragmentId),
    triggerTime: String(triggerTime || ""),
    textContent: textContent ?? null,
    storyDetail: storyDetail ?? null
  })
)
```

### Step 8：智能排期（AI 生成并保存 / 手动保存）

#### generateMapSchedule

```ts
this.sendPostHttp(
  "generateMapSchedule",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    totalDays: Number(totalDays)
  })
)
```

#### saveMapSchedule

```ts
this.sendPostHttp(
  "saveMapSchedule",
  JSON.stringify({
    token,
    mapId: Number(mapId),
    totalTasks: Number(totalTasks),
    schedule: String(scheduleJsonString || ""),
    meta: String(metaJsonString || ""),
    source: String(source || ""),
    batchIndex: Number(batchIndex || 0),
    batchTotal: Number(batchTotal || 0),
    progress: Number(progress || 0)
  })
)
```

### 草稿箱 / 审核

#### getDraftMaps

```ts
this.sendPostHttp(
  "getDraftMaps",
  JSON.stringify({ token, page: Number(page || 1), limit: Number(limit || 20) })
)
```

#### deleteDraftMap

```ts
this.sendPostHttp(
  "deleteDraftMap",
  JSON.stringify({ token, mapId: Number(mapId) })
)
```

#### submitMapForReview

```ts
this.sendPostHttp(
  "submitMapForReview",
  JSON.stringify({ token, mapId: Number(mapId) })
)
```

### Step 0：登录（拿 token）

管理端登录不在本文重点，但手机端必须先拿到 `token` 才能调用后续接口。

常用：`POST /login`（见 `miniwoedit/handler/loginHandler.go`）。

---

### Step 1：创建地图 + 保存世界属性/标题

#### 1.1 创建地图（没有 mapId 时）

- **POST** `/creatorMap`
- **body**

```json
{ "token": "xxx" }
```

- **success**

```json
{
  "success": true,
  "data": { "map_id": 123, "player_id": 456, "cmd": "...", "map": { ...map对象... } }
}
```

#### 1.2 保存标题（世界基调/地图名）

- **POST** `/saveMapTitle`
- **body**

```json
{
  "token": "xxx",
  "mapId": 123,
  "mapTitle": 1,
  "mapName": "我的世界"
}
```

- **success**

```json
{
  "success": true,
  "data": { "map_id": 123, "player_id": 456, "cmd": "...", "map": { ...map对象... } }
}
```

> 注意：后端有“步骤锁定”逻辑，已完成的更早步骤可能无法回退修改（见 `ensureMapStepWritable`）。

---

### Step 2：世界观（保存）+ AI 生成世界观

#### 2.1 保存世界观/规则/时代

- **POST** `/saveMapWorldview`
- **body**

```json
{
  "token": "xxx",
  "mapId": 123,
  "mapWorldview": "世界观描述...",
  "mapRestriction": "规则与限制...",
  "mapEra": 2
}
```

- **success**（同 Step 1.2）

#### 2.2 AI 生成世界观（转发到 AI 服务）

- **POST** `/generateWorldviewByAI`
- **body**

```json
{
  "token": "xxx",
  "mapId": 123,
  "worldName": "我的世界",
  "worldAttribute": "偏好/标签字符串",
  "eraBackground": "时代背景字符串",
  "ruleRestriction": "（可选）规则与限制"
}
```

- **success（重要）**：此接口通常 **不包** `{success:true,data:...}`，而是直接返回 AI JSON（透传）。

手机端建议：

- 同时兼容 `success/data` 和“AI 透传 JSON”两类结构。

---

### Step 3：角色（NPC）创建/编辑/列表/删除 + AI 生成人设

#### 3.1 创建 NPC

- **POST** `/creatorNpc`
- **body**：见 `miniwoedit/model/request.go:CreatorNpcRequest`

#### 3.2 查询地图 NPC 列表

- **POST** `/getNpcByMap`
- **body**

```json
{ "token": "xxx", "mapId": 123 }
```

#### 3.3 更新 NPC

- **POST** `/updateNpcById`
- **body**：见 `UpdateNpcRequest`

#### 3.4 删除 NPC

- **POST** `/delNpcById`
- **body**

```json
{ "token": "xxx", "mapId": 123, "npcId": 999 }
```

#### 3.5 AI 生成人设（转发到 AI 服务 /charGen）

- **POST** `/generateNpcByAI`
- **body**：见 `GenerateNpcByAIRequest`

关键点：

- edit 后端会对 AI 返回的 `data.npc_profile` 做规范化，并可能下载/替换图片 URL（`portrait_url`/`avatar_url`/`sprite_url`）。
- 返回结构：整体更接近 **AI 的 JSON**（不是统一 `{success,data}`）。

---

### Step 4：地图编辑（保存 map_data / 清空 map_data）

#### 4.1 保存地图编辑数据（Cocos 导出的 map_data）

- **POST** `/saveMapData`
- **body**

```json
{
  "token": "xxx",
  "mapId": 123,
  "mapData": "{...json字符串...}",
  "base64Image": "data:image/png;base64,....（可选）"
}
```

- **success**

```json
{
  "success": true,
  "data": { "map_id": 123, "player_id": 456, "cmd": "...", "map": { ...map对象... } }
}
```

#### 4.2 仅清空 map_data（保留世界观/角色等）

- **POST** `/deleteEditingMap`
- **body**

```json
{ "token": "xxx", "mapId": 123 }
```

- **success**

```json
{
  "success": true,
  "data": { "cmd": "clear_map_data_success", "map": { ...map对象... }, "map_id": 123, "player_id": 456 }
}
```

---

### Step 5：世界故事大纲（AI）

- **POST** `/generateStoryOutlineByAI`
- **body**

```json
{
  "token": "xxx",
  "mapId": 123,
  "map_info": { "houses": [], "items": [], "locations": [] },
  "npc_list": [ { "npc_id": "1", "name": "A", "profile": "..." } ],
  "story_setting": "故事设定..."
}
```

- **success（重要）**：通常是 **AI JSON 透传**（不包 `{success,data}`）。

---

### Step 6：每日故事（AI 生成并保存）

- **POST** `/generateDailyStory`
- **body**：`GenerateDailyStoryRequest`（包含 `token/mapId/totalDays/...`，以及可选的 `worldID`、`confirmedOutline` 等）
- **success**

```json
{
  "success": true,
  "data": {
    "map_id": 123,
    "total_days": 14,
    "days": [ { "day": 1, "npc_id": 1, "description": "..." } ],
    "message": "AI生成每日故事成功"
  }
}
```

---

### Step 7：卡牌与碎片剧情

#### 7.1 生成卡牌基础数据（非 LLM）

- **POST** `/generateMapCards`
- **body**：`GenerateMapCardsRequest`（`mapId` + `ssrCount/srCount/rCount/nCount` + `startDay/endDay` 等）
- **success**

```json
{
  "success": true,
  "data": {
    "map_id": 123,
    "total_cards": 100,
    "cards": [ ... ],
    "message": "卡牌基础数据创建成功"
  }
}
```

#### 7.2 单卡 AI 预览（不落库）

- **POST** `/generateCardStoryPreview`
- **body**：`GenerateCardStoryPreviewRequest`
- **success（注意：这是统一壳）**

```json
{
  "success": true,
  "data": {
    "request_payload": { "...": "发给AI的payload" },
    "ai_response": { "...": "AI返回" },
    "message": "单卡AI生成预览成功（未落库）"
  }
}
```

#### 7.3 单卡 AI 生成并保存碎片（落库）

- **POST** `/generateCardStoryAndSave`
- **body**：同 `GenerateCardStoryPreviewRequest`
- **success**：同样返回 `{success:true,data:{request_payload,ai_response,...}}`

#### 7.4 更新单个碎片触发时间

- **POST** `/updateCardFragmentTriggerTime`
- **body**：`UpdateCardFragmentTriggerTimeRequest`

---

### Step 8：智能排期（AI 生成并保存 / 手动保存）

- **POST** `/generateMapSchedule`：AI 生成并保存（`GenerateMapScheduleRequest`）
- **POST** `/saveMapSchedule`：手动保存（`SaveMapScheduleRequest`）

> 这两个接口的完整成功返回结构请以 handler 为准（在 `miniwoedit/handler/scheduleHandler.go` / `...`），手机端同样需要兼容 `{error}` 异常结构。

---

### 草稿箱 / 提交审核

- **POST** `/getDraftMaps`：草稿箱分页（`DraftMapsRequest`：`token/page/limit`）
- **POST** `/deleteDraftMap`：删除草稿（`{token,mapId}`）
- **POST** `/submitMapForReview`：提交审核（`SubmitMapRequest`：`{token,mapId}`）

---

## 3）给手机端的落地建议（强烈建议）

### 1. 客户端统一响应解析

手机端建议把返回解析做成三类兼容：

1) `{success:true, data:...}`：按 `data` 取
2) `{error:"..."}` 或 `{message:"..."}`：直接提示并当失败处理
3) AI 透传 JSON：按具体 AI 协议处理（通常有 `data` 字段，但不保证 `success`）

### 2. 本地状态（必须）

流程强依赖本地保存：

- `token`
- `creationMapId`（mapId）

---

## 附：管理端参考实现位置

- 管理端流程：`dist/miniwo_admin/js/official-creation.js`
- edit 后端路由：`miniwoedit/main.go`
- map 基础接口：`miniwoedit/handler/mapHandler.go`
- 世界观 AI：`miniwoedit/handler/worldviewAiHandler.go`
- NPC AI：`miniwoedit/handler/npcAiHandler.go`
- 故事大纲 AI：`miniwoedit/handler/storyOutlineAiHandler.go`
- 每日故事：`miniwoedit/handler/dailyStoryHandler.go`
- 卡牌剧情预览/保存：`miniwoedit/handler/cardStoryPreviewHandler.go`

