package com.fujipp.backend.store;

import com.fujipp.backend.auth.*;
import com.fujipp.backend.pagination.CursorCodec;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BotMoneyServiceTests {
    final UUID owner=UUID.randomUUID(), bot=UUID.randomUUID();
    final StoreRepository bots=mock(StoreRepository.class);
    final AdminBotRepository admins=mock(AdminBotRepository.class);
    final CurrentUserService users=mock(CurrentUserService.class);
    final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    final CursorCodec cursors=new CursorCodec(new ObjectMapper());
    final BotMoneyService service=new BotMoneyService(bots,admins,users,jdbc,cursors);
    void account(AppRole role) {
        when(users.getActiveAccount("subject")).thenReturn(new CurrentUserRepository.AccountProfile(owner,role,
                AccountStatus.ACTIVE,"owner","Owner",null,null,null,null));
    }
    void owned() {
        account(AppRole.USER);
        when(bots.findOwnedBot(bot,owner)).thenReturn(Optional.of(new BotResponse(bot,"Bot",null,null,null,null,"RUNNING","RUNNING",0,null,null)));
    }
    @Test void foreignBotsCannotReadAnyMoneyEndpoint() {
        account(AppRole.USER);
        assertThatThrownBy(()->service.overview("subject",bot,false)).isInstanceOf(StoreNotFoundException.class);
        assertThatThrownBy(()->service.customers("subject",bot,false,null,null,25)).isInstanceOf(StoreNotFoundException.class);
        assertThatThrownBy(()->service.topups("subject",bot,false,null,null,false,null,25)).isInstanceOf(StoreNotFoundException.class);
        verifyNoInteractions(jdbc);
    }
    @Test void userCannotBypassOwnershipUsingAdminRoute() {
        account(AppRole.USER);
        assertThatThrownBy(()->service.overview("subject",bot,true)).isInstanceOfSatisfying(ResponseStatusException.class,
                e->assertThat(e.getStatusCode().value()).isEqualTo(403));
        verifyNoInteractions(jdbc,admins,bots);
    }
    @Test void adminsReadTheTargetOwnersBotAndStillScopeEveryQuery() {
        account(AppRole.ADMIN);
        UUID targetOwner=UUID.randomUUID();
        when(admins.findBot(bot)).thenReturn(Optional.of(new AdminStoreResponses.Bot(bot,targetOwner,"Owner","Bot","RUNNING","RUNNING",null)));
        when(bots.findOwnedBot(bot,targetOwner)).thenReturn(Optional.of(new BotResponse(bot,"Bot",null,null,null,null,"RUNNING","RUNNING",0,null,null)));
        service.topups("subject",bot,true,null,"TRUEMONEY",true,null,25);
        verify(bots).findOwnedBot(bot,targetOwner);
        verify(bots,never()).findOwnedBot(bot,owner);
        var args=org.mockito.ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).query(anyString(),org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.RowMapper<BotMoneyService.Topup>>any(),args.capture());
        assertThat(args.getValue()[0]).isEqualTo(bot);
        assertThat(args.getValue()[1]).isEqualTo(bot);
    }

    @Test void validatesFiltersAndScopesCursorsToOwnerBotAndFilters() {
        owned();
        for(String member:List.of("123","x' OR true --"))
            assertThatThrownBy(()->service.customers("subject",bot,false,member,null,25)).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->service.topups("subject",bot,false,null,"unknown",false,null,25)).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->service.customers("subject",bot,false,null,null,101)).isInstanceOf(StoreValidationException.class);
        String other=cursors.encode("bot-money-customers",owner+":"+UUID.randomUUID()+":null",List.of("111111111111111111"));
        assertThatThrownBy(()->service.customers("subject",bot,false,null,other,25)).isInstanceOf(ResponseStatusException.class);
        String differentFilter=cursors.encode("bot-money-topups",owner+":"+bot+":null:TRUEMONEY:false",List.of("2026-11-01T00:00:00Z",UUID.randomUUID().toString()));
        assertThatThrownBy(()->service.topups("subject",bot,false,null,"SLIPOK",false,differentFilter,25)).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(jdbc);
    }
}
