const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`, {
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' }, signal: AbortSignal.timeout(15000),
});
const data = await response.json() as {
  name?: string; agent_id?: string;
  conversation_config?: { agent?: { prompt?: { llm?: string; tool_ids?: string[]; tools?: { name: string }[] }; first_message?: string } };
  platform_settings?: { auth?: { enable_auth?: boolean } };
};
console.info(JSON.stringify({ httpStatus: response.status, agentId: data.agent_id, name: data.name, llm: data.conversation_config?.agent?.prompt?.llm, toolCount: data.conversation_config?.agent?.prompt?.tool_ids?.length ?? 0, inlineTools: data.conversation_config?.agent?.prompt?.tools?.map((tool) => tool.name), signedUrlAuth: data.platform_settings?.auth?.enable_auth }));
