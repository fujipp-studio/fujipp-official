package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreConflictException;
import com.fujipp.backend.store.StoreNotFoundException;
import com.fujipp.backend.store.StoreValidationException;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.pagination.CursorPage;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AdminRuntimeService {
    private final AdminRuntimeRepository repository;
    private final CursorCodec cursors;
    private final RuntimeService runtime;
    public AdminRuntimeService(AdminRuntimeRepository repository,CursorCodec cursors,RuntimeService runtime){this.repository=repository;this.cursors=cursors;this.runtime=runtime;}
    public List<AdminRuntimeResponses.Plan> plans(){return repository.plans();}
    public List<AdminRuntimeResponses.Subscription> subscriptions(UUID owner){return repository.subscriptions(owner);}
    public CursorPage<AdminRuntimeResponses.Subscription> subscriptionsV2(UUID owner,int limit,String cursor){
        String filter=owner==null?"":owner.toString();
        var values=cursors.decode(cursor,"admin-runtime-subscriptions",filter,2);
        OffsetDateTime created=values.isEmpty()?null:cursors.dateTime(values.get(0));
        UUID id=values.isEmpty()?null:cursors.uuid(values.get(1));
        var rows=repository.subscriptionsPage(owner,created,id,limit+1);
        var page=CursorPage.of(rows,limit,row->cursors.encode("admin-runtime-subscriptions",filter,
                List.of(row.createdAt().toString(),row.item().id().toString())));
        return new CursorPage<>(page.items().stream().map(AdminRuntimeRepository.SubscriptionPageRow::item).toList(),page.nextCursor(),page.hasMore());
    }
    @Transactional public AdminRuntimeResponses.Plan updatePlan(UUID id,AdminRuntimeRequests.UpdatePlanRequest request){
        if(!repository.updatePlan(id,request)) throw new StoreNotFoundException("Runtime plan was not found");
        return repository.findPlan(id).orElseThrow();
    }
    @Transactional public AdminRuntimeResponses.Subscription grant(AdminRuntimeRequests.GrantRequest request){
        OffsetDateTime end=request.periodEnd();
        if(end!=null&&!end.isAfter(OffsetDateTime.now())) throw new StoreValidationException("periodEnd must be in the future");
        try {
            UUID id=repository.grant(request.ownerUserId(),request.planId(),request.botId(),end,request.autoRenew());
            runtime.invalidateBootstrap();
            return find(id);
        } catch(DataAccessException exception){throw new StoreConflictException("Runtime could not be granted; check owner, plan, bot, and slot availability",exception);}
    }
    @Transactional public AdminRuntimeResponses.Subscription update(UUID id,AdminRuntimeRequests.UpdateSubscriptionRequest request){
        String status=request.status().toUpperCase();
        if(!List.of("ACTIVE","GRACE","EXPIRED","CANCELLED").contains(status)) throw new StoreValidationException("Invalid runtime status");
        if(!repository.updateSubscription(id,status,request)) throw new StoreNotFoundException("Runtime subscription was not found");
        runtime.invalidateBootstrap();
        return find(id);
    }
    private AdminRuntimeResponses.Subscription find(UUID id){return repository.findSubscription(id).orElseThrow(()->new StoreNotFoundException("Runtime subscription was not found"));}
}
