import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a geographic scenario simulation assistant for the Aral Sea region. You help users visualize environmental interventions on a 3D terrain map.

## Geographic Context

The terrain covers approximately:
- Latitude: 41.5°N to 47.0°N
- Longitude: 56.0°E to 64.0°E

### Key Cities (with coordinates)
- Nukus: 42.462°N, 59.603°E
- Moynaq (Muynak): 43.773°N, 58.690°E
- Aral: 46.790°N, 61.660°E
- Kungrad: 43.005°N, 58.690°E
- Chimbay: 42.930°N, 59.770°E
- Takhtakupir: 43.015°N, 59.826°E
- Qazaly: 45.763°N, 62.110°E

### Major Water Features
- Amu Darya river: flows roughly from south (around 41.5°N, 60°E) northward through Nukus (42.46°N, 59.6°E) then toward the former Aral Sea
- Former Aral Sea center: approximately 45°N, 60°E
- South Aral Sea remnant: approximately 44.5°N, 59°E
- North Aral Sea (Kokaral): approximately 46°N, 61°E

### Canals
- Various irrigation canals branch off from the Amu Darya, primarily west and east of Nukus
- The Kurder canal region is near 42.5°N, 59.5°E

### Current State
- The Aral Sea has dramatically shrunk since the 1960s
- Current water level is around 29 meters above sea level
- Historic high was around 53 meters

## Instructions
- When the user asks to place something, use real geographic coordinates within the terrain bounds
- Use the apply_scenario tool to return structured actions that the 3D viewer can render
- You can combine multiple actions in a single tool call
- Be creative but geographically accurate
- Explain what you're placing and why the location makes sense
- For forests, a radius of 5-20 km and density of 0.3-0.8 works well
- For dams, typical width 100-500m and height 10-50m
- When placing a dam, ALWAYS set simulate: true so the reservoir flood-fill visualization is triggered
- Water level values should be between 20-55 meters
- When referencing "canals", place features along known canal routes near the Amu Darya`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "apply_scenario",
    description:
      "Apply scenario actions to the 3D terrain map. Returns structured data that the viewer renders as 3D overlays.",
    parameters: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "Array of scenario actions to apply to the terrain",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["forest", "dam", "water_level", "canal", "settlement", "label"],
                description: "Type of scenario element to place",
              },
              lat: { type: "number", description: "Latitude (for forest, dam, settlement, label)" },
              lon: { type: "number", description: "Longitude (for forest, dam, settlement, label)" },
              radius: { type: "number", description: "Radius in km (for forest)" },
              density: { type: "number", description: "Tree density 0-1 (for forest)" },
              width: { type: "number", description: "Width in meters (for dam, canal)" },
              height: { type: "number", description: "Height in meters (for dam)" },
              value: { type: "number", description: "Water level in meters (for water_level)" },
              start_lat: { type: "number", description: "Start latitude (for canal)" },
              start_lon: { type: "number", description: "Start longitude (for canal)" },
              end_lat: { type: "number", description: "End latitude (for canal)" },
              end_lon: { type: "number", description: "End longitude (for canal)" },
              name: { type: "string", description: "Name (for settlement)" },
              text: { type: "string", description: "Label text (for label)" },
              size: { type: "number", description: "Size 1-5 (for settlement)" },
            },
            required: ["type"],
            additionalProperties: false,
          },
        },
      },
      required: ["actions"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    let textContent = message?.content || "";
    let actions: unknown[] = [];

    // Extract tool calls
    if (message?.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.function?.name === "apply_scenario") {
          try {
            const parsed = JSON.parse(tc.function.arguments);
            actions = parsed.actions || [];
          } catch (e) {
            console.error("Failed to parse tool call args:", e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ content: textContent, actions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scenario-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
