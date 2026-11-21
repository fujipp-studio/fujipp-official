package com.fujipp.backend.spending;

import com.fujipp.backend.auth.*;
import com.fujipp.backend.store.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.zip.ZipInputStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MemberSpendingBackupTests {
    final UUID bot=UUID.randomUUID(), license=UUID.randomUUID(), installation=UUID.randomUUID(), owner=UUID.randomUUID();
    final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    final StoreRepository bots=mock(StoreRepository.class);
    final AdminBotRepository adminBots=mock(AdminBotRepository.class);
    final CurrentUserService users=mock(CurrentUserService.class);
    final ObjectMapper json=new ObjectMapper();
    final Clock clock=Clock.fixed(Instant.parse("2026-11-21T16:59:59Z"),ZoneOffset.UTC);
    final MemberSpendingBackupService service=new MemberSpendingBackupService(jdbc,bots,adminBots,users,json,clock);
    final String data="""
        {"members":[{"memberDiscordId":"123456789012345678","amountSatang":"9223372036854775807","txCount":2,"updatedAt":"2026-11-21T12:00:00Z"}],
         "monthlySpending":[{"memberDiscordId":"123456789012345678","month":"2026-10","amountSatang":"10000","txCount":1},
         {"memberDiscordId":"123456789012345678","month":"2026-11","amountSatang":"20000","txCount":1}]}
        """;
    @SuppressWarnings("unchecked")
    void access(boolean admin,boolean own,int count) {
        when(users.getActiveAccount("subject")).thenReturn(new CurrentUserRepository.AccountProfile(owner,admin?AppRole.ADMIN:AppRole.USER,AccountStatus.ACTIVE,"user","User",null,null,null,null));
        when(adminBots.ownerId(bot)).thenReturn(owner);
        when(bots.findOwnedBot(bot,owner)).thenReturn(Optional.of(new BotResponse(bot,"Bot",null,"987654321012345678",null,null,"RUNNING","RUNNING",0,null,null)));
        when(jdbc.query(contains("SELECT i.id"),any(RowMapper.class),eq(bot),eq(license))).thenReturn(List.of(installation));
        when(jdbc.queryForObject(contains("bool_or"),eq(Boolean.class),eq(license))).thenReturn(own);
        when(jdbc.queryForList(contains("download_count"),eq(Integer.class),eq(installation),any(LocalDate.class))).thenReturn(count==0?List.of():List.of(count));
        when(jdbc.queryForObject(contains("jsonb_build_object"),eq(String.class),eq(bot),eq(bot))).thenReturn(data);
    }
    @Test void quotaResetsAtThaiMidnightAndUsesTheInstallationNotTheUser() {
        access(false,false,4);
        assertThat(service.quota("subject",bot,license,false)).isEqualTo(new MemberSpendingBackupService.Quota(1,5,OffsetDateTime.parse("2026-11-22T00:00:00+07:00")));
        verify(jdbc).queryForList(contains("download_count"),eq(Integer.class),eq(installation),eq(LocalDate.of(2026,11,21)));
        var after=new MemberSpendingBackupService(jdbc,bots,adminBots,users,json,Clock.fixed(Instant.parse("2026-11-21T17:00:00Z"),ZoneOffset.UTC));
        after.quota("subject",bot,license,false);
        verify(jdbc).queryForList(contains("download_count"),eq(Integer.class),eq(installation),eq(LocalDate.of(2026,11,22)));
    }
    @Test void sixthDownloadDoesNotReadDataOrIncrementQuota() {
        access(false,false,5);
        assertThatThrownBy(()->service.download("subject",bot,license,false)).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(429));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        verify(jdbc,never()).queryForObject(contains("jsonb_build_object"),eq(String.class),eq(bot),eq(bot));
    }
    @Test void archivePreservesIdsAndExactAmountsAndExportsEveryMonth() throws Exception {
        access(false,false,4);
        var result=service.download("subject",bot,license,false);
        assertThat(result.filename()).isEqualTo("fujipp_member-spending_987654321012345678_"+installation+"_2026-11-21_23-59-59_ICT.zip");
        var files=new HashMap<String,String>();
        try(var zip=new ZipInputStream(new ByteArrayInputStream(result.bytes()))) {
            java.util.zip.ZipEntry entry;
            while((entry=zip.getNextEntry())!=null) files.put(entry.getName(),new String(zip.readAllBytes(),StandardCharsets.UTF_8));
        }
        assertThat(files.keySet()).containsExactlyInAnyOrder("members.csv","monthly-spending.csv","backup.json","manifest.json");
        assertThat(files.get("members.csv")).startsWith("\uFEFFmemberDiscordId,amountSatang,txCount,updatedAt\r\n").contains("\"9223372036854775807\"");
        assertThat(files.get("monthly-spending.csv")).startsWith("\uFEFF").contains("2026-10","2026-11");
        var backup=json.readTree(files.get("backup.json"));
        assertThat(backup.path("members").get(0).path("memberDiscordId").isTextual()).isTrue();
        assertThat(backup.path("members").get(0).path("amountSatang").asText()).isEqualTo("9223372036854775807");
        assertThat(backup.path("manifest").path("memberCount").asInt()).isEqualTo(1);
        assertThat(backup.path("manifest").path("monthlyRowCount").asInt()).isEqualTo(2);
        verify(jdbc).query(contains("FOR UPDATE OF i"),any(RowMapper.class),eq(bot),eq(license));
        verify(jdbc).update(contains("INSERT INTO private.member_spending_backup_quotas"),eq(installation),eq(LocalDate.of(2026,11,21)));
    }
    @Test void emptyDatabaseStillProducesAnArchiveWithHeaders() {
        var bytes=service.archive(json.readTree("{\"members\":[],\"monthlySpending\":[]}"),Map.of("formatVersion",1));
        assertThat(bytes).isNotEmpty();
    }
    @Test void generationFailureDoesNotConsumeQuota() {
        access(false,false,0);
        when(jdbc.queryForObject(contains("jsonb_build_object"),eq(String.class),eq(bot),eq(bot))).thenThrow(new IllegalStateException("database unavailable"));
        assertThatThrownBy(()->service.download("subject",bot,license,false)).isInstanceOf(IllegalStateException.class);
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }
    @Test void externalStorageAndWrongOwnersCannotExportPlatformData() {
        access(false,true,0);
        assertThatThrownBy(()->service.download("subject",bot,license,false)).isInstanceOf(StoreConflictException.class);
        when(bots.findOwnedBot(bot,owner)).thenReturn(Optional.empty());
        assertThatThrownBy(()->service.quota("subject",bot,license,false)).isInstanceOf(StoreNotFoundException.class);
    }
    @Test void aDifferentInstallationOrFeatureCannotBeDownloaded() {
        access(false,false,0);
        when(jdbc.query(contains("SELECT i.id"),any(RowMapper.class),eq(bot),eq(license))).thenReturn(List.of());
        assertThatThrownBy(()->service.download("subject",bot,license,false)).isInstanceOf(StoreNotFoundException.class);
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }
    @Test void adminUsesSameQuotaAndRequiresAnActiveAdminAccount() {
        access(false,false,0);
        assertThatThrownBy(()->service.quota("subject",bot,license,true)).isInstanceOf(ResponseStatusException.class);
        access(true,false,3);
        assertThat(service.quota("subject",bot,license,true).remaining()).isEqualTo(2);
        verify(adminBots).ownerId(bot);
    }
}
