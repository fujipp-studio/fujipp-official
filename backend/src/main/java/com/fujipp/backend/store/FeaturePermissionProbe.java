package com.fujipp.backend.store;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import java.math.BigInteger;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
class FeaturePermissionProbe {
    private final FeatureHealthRepository repository;
    private final StoreSecretCipher cipher;
    private final FeatureDiscordClient discord;
    FeaturePermissionProbe(FeatureHealthRepository repository,StoreSecretCipher cipher,FeatureDiscordClient discord) {
        this.repository=repository;this.cipher=cipher;this.discord=discord;
    }
    void check(UUID botId,String guildId,String feature,Map<String,JsonNode> config) {
        Map<String,Long> targets=new LinkedHashMap<>();
        Set<String> roleIds=new HashSet<>();
        for (var entry:config.entrySet()) {
            String key=entry.getKey();JsonNode value=entry.getValue();
            if (value==null || !value.isTextual() || value.asText().isBlank()) continue;
            if (key.endsWith("_CHANNEL_ID") || key.equals("CHANNEL_ID")) targets.merge(value.asText(),key.equals("PRICE_READER_ORDER_CHANNEL_ID") ? 1024L : required(feature),(a,b)->a|b);
            if (key.endsWith("_ROLE_ID")) roleIds.add(value.asText());
        }
        var categories=config.get("TICKET_CATEGORIES");
        if (categories!=null && categories.isArray()) for (var category:categories) {
            targets.put(category.path("categoryId").asText(),1024L|16L|268435456L|65536L);
            for (var role:category.path("supportRoleIds")) roleIds.add(role.asText());
        }
        if (targets.isEmpty() && roleIds.isEmpty()) return;
        if (guildId==null || !guildId.matches("[0-9]{15,30}")) throw new StoreValidationException("ตั้งค่า Discord Server ID ของบอทก่อนลองเริ่มฟีเจอร์");
        var secret=repository.credential(botId).orElseThrow(()->new StoreValidationException("ตั้งค่า Discord token ของบอทก่อน"));
        String token=cipher.decrypt(secret.ciphertext(),secret.nonce(),secret.keyVersion());
        var self=discord.get(token,"/users/@me");
        String selfId=self.path("id").asText();
        if (!selfId.matches("[0-9]{15,30}")) throw new StoreValidationException("Discord returned an invalid bot identity");
        var member=discord.get(token,"/guilds/"+guildId+"/members/"+selfId);
        var roles=discord.get(token,"/guilds/"+guildId+"/roles");
        var channels=discord.get(token,"/guilds/"+guildId+"/channels");
        Set<String> ownRoles=new HashSet<>();ownRoles.add(guildId);
        for (var role:member.path("roles")) ownRoles.add(role.asText());
        BigInteger base=BigInteger.ZERO;
        Set<String> existingRoles=new HashSet<>();
        Map<String,JsonNode> roleMetadata=new HashMap<>();
        int highestPosition=0;
        for (var role:roles) {
            String id=role.path("id").asText();existingRoles.add(id);roleMetadata.put(id,role);
            if (ownRoles.contains(id)) highestPosition=Math.max(highestPosition,role.path("position").asInt());
            if (ownRoles.contains(id)) base=base.or(bits(role.path("permissions")));
        }
        if (!existingRoles.containsAll(roleIds)) throw new StoreValidationException("ยศที่ตั้งค่าไว้บางรายการถูกลบหรือไม่ได้อยู่ในเซิร์ฟเวอร์นี้");
        if (feature.equals("review-credit") && !roleIds.isEmpty()) {
            if (!base.testBit(3) && !base.testBit(28)) throw new StoreValidationException("บอทต้องมีสิทธิ์ Manage Roles เพื่อให้ยศรีวิว");
            for (String id:roleIds) {
                var role=roleMetadata.get(id);
                if (id.equals(guildId) || role.path("managed").asBoolean() || role.path("position").asInt()>=highestPosition)
                    throw new StoreValidationException("ยศรีวิวต้องอยู่ต่ำกว่ายศสูงสุดของบอท และไม่ใช่ยศที่ระบบอื่นจัดการ");
            }
        }
        Map<String,JsonNode> byId=new HashMap<>();
        for (var channel:channels) byId.put(channel.path("id").asText(),channel);
        for (var target:targets.entrySet()) {
            if (!target.getKey().matches("[0-9]{15,30}")) throw new StoreValidationException("ตั้งค่า Channel ID ให้ถูกต้องก่อนลองใหม่");
            JsonNode channel=byId.get(target.getKey());
            if (channel==null) channel=discord.get(token,"/channels/"+target.getKey());
            if (!guildId.equals(channel.path("guild_id").asText())) throw new StoreValidationException("ห้องที่ตั้งค่าไม่ได้อยู่ในเซิร์ฟเวอร์ของบอท");
            int type=channel.path("type").asInt();
            boolean thread=type==10 || type==11 || type==12;
            JsonNode permissionChannel=channel;
            if (thread) {
                permissionChannel=byId.get(channel.path("parent_id").asText());
                if (permissionChannel==null) throw new StoreValidationException("ไม่พบห้องหลักของ Thread ที่ตั้งค่าไว้");
            }
            long mask=target.getValue();
            if (thread && (mask&2048L)!=0) mask=(mask&~2048L)|(1L<<38);
            BigInteger effective=effectivePermissions(base,permissionChannel.path("permission_overwrites"),guildId,selfId,ownRoles);
            if (!effective.and(BigInteger.valueOf(mask)).equals(BigInteger.valueOf(mask)))
                throw new StoreValidationException("บอทมีสิทธิ์ไม่พอในห้อง "+target.getKey()+" ตรวจ View Channel / Send Messages / Read Message History และสิทธิ์ที่ฟีเจอร์ใช้");
        }
    }
    static long required(String feature) {
        return switch(feature) {
            case "price-reader" -> 1024L|2048L|65536L|16384L;
            case "review-credit" -> 1024L|2048L|65536L|16L|64L;
            case "shop-status" -> 1024L|2048L|16384L|16L;
            case "voice-keeper" -> 1024L|1048576L;
            default -> 1024L;
        };
    }
    static BigInteger effectivePermissions(BigInteger base,JsonNode overwrites,String guild,String member,Set<String> roles) {
        if (base.testBit(3)) return BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
        BigInteger result=base,deny=BigInteger.ZERO,allow=BigInteger.ZERO;
        for (var row:overwrites) if (row.path("id").asText().equals(guild)) result=result.andNot(bits(row.path("deny"))).or(bits(row.path("allow")));
        for (var row:overwrites) if (row.path("type").asInt()==0 && roles.contains(row.path("id").asText()) && !row.path("id").asText().equals(guild)) {
            deny=deny.or(bits(row.path("deny")));allow=allow.or(bits(row.path("allow")));
        }
        result=result.andNot(deny).or(allow);
        for (var row:overwrites) if (row.path("type").asInt()==1 && row.path("id").asText().equals(member)) result=result.andNot(bits(row.path("deny"))).or(bits(row.path("allow")));
        return result;
    }
    private static BigInteger bits(JsonNode value) {
        try { var result=new BigInteger(value.asText("0")); if (result.signum()<0) throw new NumberFormatException(); return result; }
        catch (NumberFormatException error) { throw new StoreValidationException("Discord returned invalid permission metadata"); }
    }
}
