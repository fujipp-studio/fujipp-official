package com.fujipp.backend.spending;

import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.store.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class MemberSpendingBackupService {
    static final ZoneId ZONE = ZoneId.of("Asia/Bangkok");
    static final int LIMIT = 5;
    private final JdbcTemplate jdbc;
    private final StoreRepository bots;
    private final AdminBotRepository adminBots;
    private final CurrentUserService users;
    private final ObjectMapper json;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public MemberSpendingBackupService(JdbcTemplate jdbc, StoreRepository bots, AdminBotRepository adminBots,
                                      CurrentUserService users, ObjectMapper json) {
        this(jdbc, bots, adminBots, users, json, Clock.systemUTC());
    }
    MemberSpendingBackupService(JdbcTemplate jdbc, StoreRepository bots, AdminBotRepository adminBots,
                               CurrentUserService users, ObjectMapper json, Clock clock) {
        this.jdbc=jdbc; this.bots=bots; this.adminBots=adminBots; this.users=users; this.json=json; this.clock=clock;
    }
    public record Quota(int remaining, int limit, OffsetDateTime resetsAt) {}
    public record Backup(String filename, byte[] bytes) {}
    private record Access(UUID installationId, String guildId) {}

    private Access access(String subject, UUID botId, UUID licenseId, boolean admin, boolean lock) {
        var account=users.getActiveAccount(subject);
        UUID owner=account.id();
        if (admin) {
            if (account.role()!=AppRole.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            owner=adminBots.ownerId(botId);
            if (owner==null) throw new StoreNotFoundException("Bot was not found");
        }
        var bot=bots.findOwnedBot(botId,owner).orElseThrow(()->new StoreNotFoundException("Bot was not found"));
        var ids=jdbc.query("""
            SELECT i.id FROM private.bot_feature_installations i
            JOIN shop.feature_products p ON p.id=i.feature_product_id AND p.code='member-spending'
            WHERE i.bot_id=? AND i.license_id=? AND i.removed_at IS NULL
            """ + (lock ? " FOR UPDATE OF i" : ""), (rs,row)->rs.getObject(1,UUID.class),botId,licenseId);
        if (ids.size()!=1) throw new StoreNotFoundException("Installed Member Spending Card was not found");
        Boolean own=jdbc.queryForObject("""
            SELECT COALESCE(bool_or(COALESCE(v.value,d.default_value)='true'::jsonb),false)
            FROM private.feature_config_sets c
            JOIN shop.feature_config_definitions d ON d.feature_version_id=c.feature_version_id
            LEFT JOIN private.feature_config_values v ON v.config_set_id=c.id AND v.definition_id=d.id
            WHERE c.license_id=? AND d.config_key='SPENDING_DB_USE_OWN'
            """,Boolean.class,licenseId);
        if (Boolean.TRUE.equals(own)) throw new StoreConflictException("Backup is available only when using Fujipp storage");
        return new Access(ids.getFirst(),bot.discordGuildId());
    }
    @Transactional(readOnly=true)
    public Quota quota(String subject, UUID botId, UUID licenseId, boolean admin) {
        var access=access(subject,botId,licenseId,admin,false);
        var today=LocalDate.now(clock.withZone(ZONE));
        var counts=jdbc.queryForList("SELECT download_count FROM private.member_spending_backup_quotas WHERE installation_id=? AND download_day=?",
            Integer.class,access.installationId(),today);
        return new Quota(LIMIT-(counts.isEmpty()?0:counts.getFirst()),LIMIT,today.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime());
    }
    @Transactional
    public Backup download(String subject, UUID botId, UUID licenseId, boolean admin) {
        // The installation row serializes quota checks across requests and backend instances.
        var access=access(subject,botId,licenseId,admin,true);
        var now=ZonedDateTime.now(clock.withZone(ZONE));
        var counts=jdbc.queryForList("SELECT download_count FROM private.member_spending_backup_quotas WHERE installation_id=? AND download_day=?",
            Integer.class,access.installationId(),now.toLocalDate());
        if (!counts.isEmpty() && counts.getFirst()>=LIMIT)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Daily backup limit reached. Resets at 00:00 Asia/Bangkok");
        // One SQL statement provides a consistent snapshot of lifetime and all monthly rows.
        var data=jdbc.queryForObject("""
            SELECT jsonb_build_object(
              'members',COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'memberDiscordId',member_discord_id,'amountSatang',amount_satang::text,
                'txCount',tx_count,'updatedAt',updated_at) ORDER BY member_discord_id)
                FROM private.member_spending WHERE bot_id=?),'[]'::jsonb),
              'monthlySpending',COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'memberDiscordId',member_discord_id,'month',to_char(month,'YYYY-MM'),
                'amountSatang',amount_satang::text,'txCount',tx_count) ORDER BY month,member_discord_id)
                FROM private.member_spending_monthly WHERE bot_id=?),'[]'::jsonb))::text
            """,String.class,botId,botId);
        var snapshot=json.readTree(data);
        var manifest=new LinkedHashMap<String,Object>();
        manifest.put("formatVersion",1);
        manifest.put("feature","member-spending");
        manifest.put("exportedAt",now.toOffsetDateTime().toString());
        manifest.put("timezone",ZONE.getId());
        manifest.put("botId",botId.toString());
        manifest.put("guildId",access.guildId());
        manifest.put("installationId",access.installationId().toString());
        manifest.put("currency","THB");
        manifest.put("amountUnit","satang");
        manifest.put("memberCount",snapshot.path("members").size());
        manifest.put("monthlyRowCount",snapshot.path("monthlySpending").size());
        byte[] bytes=archive(snapshot,manifest);
        jdbc.update("""
            INSERT INTO private.member_spending_backup_quotas(installation_id,download_day,download_count)
            VALUES(?,?,1) ON CONFLICT(installation_id,download_day)
            DO UPDATE SET download_count=private.member_spending_backup_quotas.download_count+1
            """,access.installationId(),now.toLocalDate());
        String guild=access.guildId()==null?"unconfigured":access.guildId().replaceAll("[^0-9]","");
        return new Backup("fujipp_member-spending_"+guild+"_"+access.installationId()+"_"+
            now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"))+"_ICT.zip",bytes);
    }
    byte[] archive(JsonNode snapshot, Map<String,Object> manifest) {
        try (var output=new ByteArrayOutputStream(); var zip=new ZipOutputStream(output,StandardCharsets.UTF_8)) {
            var backup=new LinkedHashMap<String,Object>();
            backup.put("manifest",manifest);
            backup.put("members",snapshot.path("members"));
            backup.put("monthlySpending",snapshot.path("monthlySpending"));
            entry(zip,"members.csv",csv(snapshot.path("members"),"memberDiscordId","amountSatang","txCount","updatedAt"));
            entry(zip,"monthly-spending.csv",csv(snapshot.path("monthlySpending"),"memberDiscordId","month","amountSatang","txCount"));
            entry(zip,"backup.json",json.writeValueAsBytes(backup));
            entry(zip,"manifest.json",json.writeValueAsBytes(manifest));
            zip.finish();
            return output.toByteArray();
        } catch (IOException error) { throw new IllegalStateException("Unable to create backup",error); }
    }
    private static void entry(ZipOutputStream zip,String name,byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(name)); zip.write(bytes); zip.closeEntry();
    }
    private static byte[] csv(JsonNode rows,String... columns) {
        var csv=new StringBuilder("\uFEFF").append(String.join(",",columns)).append("\r\n");
        for (var row:rows) {
            for (int i=0;i<columns.length;i++) {
                if(i>0) csv.append(',');
                csv.append('"').append(row.path(columns[i]).asText().replace("\"","\"\"")).append('"');
            }
            csv.append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
}
