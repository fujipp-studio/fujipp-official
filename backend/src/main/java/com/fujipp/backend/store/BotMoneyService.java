package com.fujipp.backend.store;

import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.pagination.CursorPage;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Read-only, owner-scoped view of Discord member Wallets (not website billing). */
@Service
class BotMoneyService {
    private final StoreRepository bots;
    private final AdminBotRepository adminBots;
    private final CurrentUserService users;
    private final JdbcTemplate jdbc;
    private final CursorCodec cursors;

    BotMoneyService(StoreRepository bots, AdminBotRepository adminBots, CurrentUserService users, JdbcTemplate jdbc, CursorCodec cursors) {
        this.bots=bots; this.adminBots=adminBots; this.users=users; this.jdbc=jdbc; this.cursors=cursors;
    }

    record Overview(long customerCount, String balanceSatang, String trueMoneyTopupSatang,
                    String slipOkTopupSatang, long reviewCount, String currency) {}
    record Customer(String memberDiscordId, String balanceSatang, String totalTopupSatang, OffsetDateTime lastTopupAt) {}
    record Topup(UUID id, String memberDiscordId, String provider, String status, String grossSatang,
                 String feeSatang, String creditedSatang, String reference, String failureCode,
                 boolean legacy, OffsetDateTime createdAt) {}

    private UUID authorize(String subject, UUID botId, boolean admin) {
        var account=users.getActiveAccount(subject);
        UUID owner=account.id();
        if (admin) {
            if (account.role()!=AppRole.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            owner=adminBots.findBot(botId).orElseThrow(()->new StoreNotFoundException("Bot was not found")).ownerUserId();
        }
        bots.findOwnedBot(botId,owner).orElseThrow(()->new StoreNotFoundException("Bot was not found"));
        return owner;
    }

    Overview overview(String subject, UUID botId, boolean admin) {
        authorize(subject,botId,admin);
        return jdbc.queryForObject(OVERVIEW, (rs,n)->new Overview(rs.getLong("customers"),rs.getString("balance"),rs.getString("truemoney"),
                rs.getString("slipok"),rs.getLong("review"),"THB"),botId,botId,botId,botId);
    }

    CursorPage<Customer> customers(String subject, UUID botId, boolean admin, String member, String cursor, int limit) {
        UUID owner=authorize(subject,botId,admin);
        validate(member,limit);
        String binding=owner+":"+botId+":"+member;
        var after=cursors.decode(cursor,"bot-money-customers",binding,1);
        String last=after.isEmpty()?"":after.getFirst();
        if (!last.isEmpty() && !last.matches("[0-9]{15,30}")) throw new StoreValidationException("Invalid pagination cursor");
        var rows=jdbc.query(CUSTOMERS, (rs,n)->new Customer(rs.getString(1),rs.getString(2),rs.getString(3),rs.getObject(4,OffsetDateTime.class)),
                botId,last,member,member,limit+1);
        return CursorPage.of(rows,limit,r->cursors.encode("bot-money-customers",binding,List.of(r.memberDiscordId())));
    }

    // Credit rows are authoritative. Uncredited provider attempts are shown alongside
    // them, so SUCCEEDED upstream never falsely implies that a customer was credited.
    private static final String HISTORY=query("history");
    private static final String OVERVIEW=query("overview");
    private static final String CUSTOMERS=query("customers");
    private static String query(String name) {
        try {
            return new org.springframework.core.io.ClassPathResource("sql/bot-money/"+name+".sql")
                    .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.io.IOException error) { throw new IllegalStateException("Missing Money query",error); }
    }

    CursorPage<Topup> topups(String subject, UUID botId, boolean admin, String member, String provider,
                            boolean review, String cursor, int limit) {
        UUID owner=authorize(subject,botId,admin);
        validate(member,limit);
        if (provider!=null && !Set.of("TRUEMONEY","SLIPOK").contains(provider)) throw new StoreValidationException("Invalid provider");
        String binding=owner+":"+botId+":"+member+":"+provider+":"+review;
        var after=cursors.decode(cursor,"bot-money-topups",binding,2);
        var args=new ArrayList<Object>(java.util.Arrays.asList(botId,botId,member,member,provider,provider,review));
        String sql=HISTORY;
        if (!after.isEmpty()) {
            sql+=" AND (created_at,id)<(?,?)";
            args.add(cursors.dateTime(after.getFirst())); args.add(cursors.uuid(after.get(1)));
        }
        sql+=" ORDER BY created_at DESC,id DESC LIMIT ?";
        args.add(limit+1);
        var rows=jdbc.query(sql,(rs,n)->new Topup(rs.getObject("id",UUID.class),rs.getString("member_discord_id"),
                rs.getString("provider"),rs.getString("status"),rs.getString("gross"),rs.getString("fee"),
                rs.getString("credited"),rs.getString("reference"),rs.getString("failure_code"),
                rs.getBoolean("legacy"),rs.getObject("created_at",OffsetDateTime.class)),args.toArray());
        return CursorPage.of(rows,limit,r->cursors.encode("bot-money-topups",binding,List.of(r.createdAt().toString(),r.id().toString())));
    }

    private void validate(String member,int limit) {
        if (limit<1||limit>100) throw new StoreValidationException("Limit must be 1–100");
        if (member!=null && !member.matches("[0-9]{15,30}")) throw new StoreValidationException("Invalid Discord ID");
    }
}
