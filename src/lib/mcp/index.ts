import { defineMcp } from "@lovable.dev/mcp-js";
import listPlants from "./tools/list-plants";
import getPlant from "./tools/get-plant";
import listTrends from "./tools/list-trends";

export default defineMcp({
  name: "botanical-studio-mcp",
  title: "Botanical Studio",
  version: "0.1.0",
  instructions:
    "Read-only access to the Botanical Studio content library. Use `list_plants` to browse recent botanical posts, `get_plant` to fetch a single post's script and caption by id, and `list_trends` for trend research rows.",
  tools: [listPlants, getPlant, listTrends],
});
