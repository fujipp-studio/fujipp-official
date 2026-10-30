package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

@Service
class RuntimeTicketService {
    private final TicketRecordRepository records;
    private final JdbcTemplate jdbc;
    private final StoreRepository bots;
    private final StoreSecretCipher cipher;
    private final DiscordTicketClient discord;
    private final ObjectMapper json;
    private final TicketCounterService counters;
    RuntimeTicketService(TicketRecordRepository records, JdbcTemplate jdbc, StoreRepository bots, StoreSecretCipher cipher, DiscordTicketClient discord, ObjectMapper json,TicketCounterService counters) {
        this.records=records;this.jdbc=jdbc;this.bots=bots;this.cipher=cipher;this.discord=discord;this.json=json;
        this.counters=counters;
    }
    int nextNumber(UUID botId,UUID installationId) { access(botId,installationId); return counters.reserve(botId); }
    record Installation(UUID owner, String guild) {}
    record Ticket(String channelId,String name,JsonNode state,boolean archived) {}
    private Installation access(UUID botId,UUID installationId) {
        return jdbc.query("""
            SELECT b.owner_user_id,b.discord_guild_id FROM private.bot_feature_installations i
            JOIN bots.bot_instances b ON b.id=i.bot_id JOIN shop.feature_products p ON p.id=i.feature_product_id
            JOIN private.feature_licenses l ON l.id=i.license_id
            WHERE i.bot_id=? AND i.id=? AND p.code='ticket' AND i.removed_at IS NULL
              AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>now())
            """,(rs,n)->new Installation(rs.getObject("owner_user_id",UUID.class),rs.getString("discord_guild_id")),botId,installationId)
            .stream().findFirst().orElseThrow(()->new StoreNotFoundException("Ticket installation was not found"));
    }
    List<Ticket> list(UUID botId,UUID installationId) {
        access(botId,installationId);
        return records.list(botId).stream().filter(e->e.installationId().equals(installationId))
            .map(e->new Ticket(e.channelId(),e.name(),e.state(),e.archived())).toList();
    }
    void save(UUID botId,UUID installationId,String channelId,String name,JsonNode state) {
        Installation installation=access(botId,installationId);
        id(channelId);
        validateState(state);
        if(name==null||name.isBlank()||name.length()>100) throw new StoreValidationException("Invalid Ticket channel name");
        var previous=records.find(botId,channelId);
        if(previous.isEmpty()) {
            var secret=bots.findBotCredential(botId,installation.owner(),"DISCORD_TOKEN");
            if(secret==null) throw new StoreValidationException("Discord token is not configured");
            var channel=discord.channel(cipher.decrypt(secret.ciphertext(),secret.nonce(),secret.keyVersion()),channelId);
            if(channel.path("type").asInt(-1)!=0 || !Objects.equals(installation.guild(),channel.path("guild_id").asText()))
                throw new StoreNotFoundException("Ticket channel was not found in this bot's server");
        }
        if(state.path("status").asText().equals("CLOSED") && previous.isPresent() && !previous.get().archived()
                && !previous.get().state().path("status").asText().equals("CLOSED"))
            throw new StoreValidationException("Archive Ticket history before deleting its channel");
        records.save(botId,installationId,channelId,name,state);
    }
    void archive(UUID botId,UUID installationId,String channelId,JsonNode messages) {
        access(botId,installationId); id(channelId);
        if(messages==null||!messages.isArray()||messages.size()>10000||messages.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>10*1024*1024)
            throw new StoreValidationException("Ticket archive exceeds 10000 messages or 10 MiB; keep the channel and export history manually");
        var cleaned=json.createArrayNode();
        var ids=new HashSet<String>();
        for(JsonNode message:messages) {
            id(message.path("id").asText()); id(message.path("author").path("id").asText());
            if(!ids.add(message.path("id").asText())) throw new StoreValidationException("Duplicate archived message");
            cleaned.add(json.valueToTree(TicketHistoryService.message(message)));
        }
        if(cleaned.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>10*1024*1024)
            throw new StoreValidationException("Normalized Ticket archive exceeds 10 MiB; the channel must be retained");
        records.archive(botId,installationId,channelId,cleaned);
    }
    static void validateState(JsonNode state) {
        if(state==null||!state.isObject()||state.toString().length()>8192) throw new StoreValidationException("Invalid Ticket state");
        id(state.path("ownerId").asText());
        if(state.has("autoCloseStartAt") && (!state.path("autoCloseStartAt").isIntegralNumber() || !state.path("autoCloseStartAt").canConvertToLong()
                || state.path("autoCloseStartAt").asLong()<=0 || state.path("autoCloseStartAt").asLong()>9007199254740991L)) throw new StoreValidationException("Invalid Ticket timer start");
        if(state.has("participantIds")) {
            JsonNode participants=state.path("participantIds");
            if(!participants.isArray() || participants.size()>25) throw new StoreValidationException("Configure at most 25 Ticket participants");
            var unique=new HashSet<String>();
            for(JsonNode participant:participants) {
                if(!participant.isTextual()) throw new StoreValidationException("Invalid Ticket participant ID");
                id(participant.asText());
                if(!unique.add(participant.asText())) throw new StoreValidationException("Duplicate Ticket participant");
            }
        }
        if(state.has("ticketNumber") && (!state.path("ticketNumber").isIntegralNumber() || !state.path("ticketNumber").canConvertToInt() || state.path("ticketNumber").asInt()<0 || state.path("ticketNumber").asInt()>99999))
            throw new StoreValidationException("Invalid Ticket number");
        if(state.has("exemption")) {
            JsonNode request=state.path("exemption");
            id(request.path("requestedBy").asText());
            if(!Set.of("PENDING","APPROVED","DENIED").contains(request.path("status").asText()) || !request.path("requestedAt").isIntegralNumber() || request.path("requestedAt").asLong()<=0)
                throw new StoreValidationException("Invalid Ticket timer exemption request");
            if(!request.path("status").asText().equals("PENDING")) {
                id(request.path("decidedBy").asText());
                if(!request.path("decidedAt").isIntegralNumber() || request.path("decidedAt").asLong()<=0) throw new StoreValidationException("Invalid Ticket timer exemption decision");
            }
        }
        if(!state.path("categoryKey").asText().matches("[a-z0-9_-]{1,32}")||!Set.of("OPEN","CLOSING","CLOSED").contains(state.path("status").asText())
            ||!state.path("openedAt").isIntegralNumber()||!state.path("openedAt").canConvertToLong()||state.path("openedAt").asLong()<=0
            ||!state.path("autoCloseMinutes").isIntegralNumber()||!state.path("autoCloseMinutes").canConvertToInt()||state.path("autoCloseMinutes").asInt()<0||state.path("autoCloseMinutes").asInt()>43200
            ||!Set.of("IDLE","OPENED").contains(state.path("autoCloseMode").asText())) throw new StoreValidationException("Invalid Ticket state");
        if(!state.path("supportRoleIds").isArray()||state.path("supportRoleIds").size()>10) throw new StoreValidationException("Invalid Ticket roles");
        for(JsonNode role:state.path("supportRoleIds")) id(role.asText());
    }
    private static void id(String id) { if(id==null||!id.matches("[0-9]{15,30}")) throw new StoreValidationException("Invalid Discord ID"); }
}
