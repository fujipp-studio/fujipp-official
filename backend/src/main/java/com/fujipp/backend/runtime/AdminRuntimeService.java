package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreConflictException;
import com.fujipp.backend.store.StoreNotFoundException;
import com.fujipp.backend.store.StoreValidationException;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AdminRuntimeService {
    private final AdminRuntimeRepository repository;
    public AdminRuntimeService(AdminRuntimeRepository repository){this.repository=repository;}
    public List<AdminRuntimeResponses.Plan> plans(){return repository.plans();}
    public List<AdminRuntimeResponses.Subscription> subscriptions(UUID owner){return repository.subscriptions(owner);}
    @Transactional public AdminRuntimeResponses.Plan updatePlan(UUID id,AdminRuntimeRequests.UpdatePlanRequest request){
        if(!repository.updatePlan(id,request)) throw new StoreNotFoundException("Runtime plan was not found");
        return repository.findPlan(id).orElseThrow();
    }
    @Transactional public AdminRuntimeResponses.Subscription grant(AdminRuntimeRequests.GrantRequest request){
        OffsetDateTime end=request.periodEnd();
        if(end!=null&&!end.isAfter(OffsetDateTime.now())) throw new StoreValidationException("periodEnd must be in the future");
        try {
            UUID id=repository.grant(request.ownerUserId(),request.planId(),request.botId(),end,request.autoRenew());
            return find(id);
        } catch(DataAccessException exception){throw new StoreConflictException("Runtime could not be granted; check owner, plan, bot, and slot availability",exception);}
    }
    @Transactional public AdminRuntimeResponses.Subscription update(UUID id,AdminRuntimeRequests.UpdateSubscriptionRequest request){
        String status=request.status().toUpperCase();
        if(!List.of("ACTIVE","GRACE","EXPIRED","CANCELLED").contains(status)) throw new StoreValidationException("Invalid runtime status");
        if(!repository.updateSubscription(id,status,request)) throw new StoreNotFoundException("Runtime subscription was not found");
        return find(id);
    }
    private AdminRuntimeResponses.Subscription find(UUID id){return repository.findSubscription(id).orElseThrow(()->new StoreNotFoundException("Runtime subscription was not found"));}
}
