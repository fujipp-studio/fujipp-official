package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AdminBotRepository {
    private final JdbcTemplate jdbc;
    public AdminBotRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<AdminStoreResponses.Bot> findBots(String query) {
        String filter = query == null || query.isBlank() ? "%" : "%" + query.trim().toLowerCase() + "%";
        return jdbc.query("""
                SELECT bot.id, bot.owner_user_id, COALESCE(profile.display_name,profile.username,'User') owner_name,
                       bot.name,bot.status::text,bot.desired_state::text,bot.created_at
                  FROM bots.bot_instances bot LEFT JOIN public.profiles profile ON profile.id=bot.owner_user_id
                 WHERE lower(bot.name) LIKE ? OR lower(COALESCE(profile.display_name,'')) LIKE ?
                    OR lower(COALESCE(profile.username,'')) LIKE ? OR lower(bot.id::text) LIKE ?
                 ORDER BY bot.created_at DESC LIMIT 200
                """, (rs,n)->map(rs), filter,filter,filter,filter);
    }

    public Optional<AdminStoreResponses.Bot> findBot(UUID botId) {
        return jdbc.query("""
                SELECT bot.id,bot.owner_user_id,COALESCE(profile.display_name,profile.username,'User') owner_name,
                       bot.name,bot.status::text,bot.desired_state::text,bot.created_at
                  FROM bots.bot_instances bot LEFT JOIN public.profiles profile ON profile.id=bot.owner_user_id
                 WHERE bot.id=?
                """, (rs,n)->map(rs), botId).stream().findFirst();
    }

    public UUID ownerId(UUID botId) {
        return jdbc.query("SELECT owner_user_id FROM bots.bot_instances WHERE id=?",
                rs->rs.next()?rs.getObject(1,UUID.class):null,botId);
    }

    public boolean licenseInstalledOnBot(UUID licenseId,UUID botId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM private.bot_feature_installations
                 WHERE license_id=? AND bot_id=? AND removed_at IS NULL)
                """,Boolean.class,licenseId,botId));
    }

    public boolean userExists(UUID userId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM private.user_accounts WHERE user_id=?)", Boolean.class, userId));
    }

    public boolean transfer(UUID botId, UUID newOwnerUserId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT private.admin_transfer_bot(?,?)", Boolean.class, botId, newOwnerUserId));
    }

    public boolean control(UUID botId, String action) {
        String desiredState = "stop".equals(action) ? "STOPPED" : "RUNNING";
        return jdbc.update("""
                UPDATE bots.bot_instances
                   SET desired_state = ?::bots.bot_desired_state,
                       restart_revision = restart_revision + CASE WHEN ? THEN 1 ELSE 0 END
                 WHERE id = ? AND status NOT IN ('SUSPENDED', 'DECOMMISSIONED')
                """, desiredState, "restart".equals(action), botId) > 0;
    }

    public Optional<BotResponse> findSettings(UUID botId) {
        return jdbc.query("""
                SELECT id,name,discord_application_id,discord_guild_id,discord_username,
                       discord_avatar_url,status::text,desired_state::text,restart_revision,
                       created_at,updated_at FROM bots.bot_instances WHERE id=?
                """, (rs,n) -> new BotResponse(rs.getObject("id",UUID.class),rs.getString("name"),
                rs.getString("discord_application_id"),rs.getString("discord_guild_id"),
                rs.getString("discord_username"),rs.getString("discord_avatar_url"),
                rs.getString("status"),rs.getString("desired_state"),rs.getLong("restart_revision"),
                rs.getObject("created_at",OffsetDateTime.class),rs.getObject("updated_at",OffsetDateTime.class)), botId)
                .stream().findFirst();
    }

    public boolean updateSettings(UUID botId, UpdateBotRequest request) {
        return jdbc.update("""
                UPDATE bots.bot_instances SET name=?,discord_application_id=?,discord_guild_id=?
                 WHERE id=? AND status<>'DECOMMISSIONED'
                """, request.name().trim(), request.discordApplicationId(), request.discordGuildId(), botId) > 0;
    }

    private AdminStoreResponses.Bot map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new AdminStoreResponses.Bot(rs.getObject("id",UUID.class),rs.getObject("owner_user_id",UUID.class),
                rs.getString("owner_name"),rs.getString("name"),rs.getString("status"),
                rs.getString("desired_state"),rs.getObject("created_at", OffsetDateTime.class));
    }
}
