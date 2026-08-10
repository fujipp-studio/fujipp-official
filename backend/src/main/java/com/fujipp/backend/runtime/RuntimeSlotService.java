package com.fujipp.backend.runtime;

import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.store.StoreConflictException;
import com.fujipp.backend.store.StoreNotFoundException;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class RuntimeSlotService {
    private final RuntimeSlotRepository repository;
    private final CurrentUserService users;
    public RuntimeSlotService(RuntimeSlotRepository repository, CurrentUserService users) {
        this.repository=repository; this.users=users;
    }
    public List<RuntimePlanResponse> plans(){ return repository.plans(); }
    public int availableSlots(){ return repository.availableSlots(); }
    public RuntimeAvailabilityResponse availability(){ return repository.availability(); }
    public List<RuntimeSubscriptionResponse> subscriptions(String subject){ return repository.subscriptions(userId(subject)); }
    @Transactional public RuntimeSubscriptionResponse purchase(String subject, UUID planId){
        UUID owner=userId(subject);
        try { UUID id=repository.purchase(owner,planId); return find(owner,id); }
        catch (DataAccessException exception) { throw new StoreConflictException("Runtime purchase could not be completed",exception); }
    }
    @Transactional public RuntimeSubscriptionResponse assign(String subject, UUID id, UUID botId){
        UUID owner=userId(subject);
        try {
            if(!repository.assign(id,owner,botId)) throw new StoreNotFoundException("Runtime subscription was not found");
            return find(owner,id);
        } catch (DataAccessException exception) { throw new StoreConflictException("This bot already has a Runtime slot",exception); }
    }
    @Transactional public RuntimeSubscriptionResponse autoRenew(String subject, UUID id, boolean enabled){
        UUID owner=userId(subject);
        if(!repository.setAutoRenew(id,owner,enabled)) throw new StoreNotFoundException("Runtime subscription was not found");
        return find(owner,id);
    }
    @Transactional public RuntimeSubscriptionResponse renew(String subject, UUID id){
        UUID owner=userId(subject);
        try {
            if(!repository.renew(id,owner)) throw new StoreConflictException("Runtime could not be renewed");
            return find(owner,id);
        } catch (DataAccessException exception) { throw new StoreConflictException("Runtime renewal could not be completed",exception); }
    }
    public void requireRunnable(UUID botId, UUID ownerId){
        if(!repository.hasRunnableRuntime(botId,ownerId)) throw new StoreConflictException("Attach an active Runtime slot before starting this bot");
    }
    @Scheduled(fixedDelayString="${app.runtime.reconcile-ms:60000}")
    public void reconcile(){
        repository.reconcileExpiry();
        for(UUID id:repository.dueAutoRenewals()) {
            try { repository.renewAutomatically(id); } catch (DataAccessException ignored) { /* retry next cycle */ }
        }
        repository.reconcileExpiry();
    }
    private UUID userId(String subject){ return users.getActiveAccount(subject).id(); }
    private RuntimeSubscriptionResponse find(UUID owner,UUID id){ return repository.subscriptions(owner).stream()
            .filter(item->item.id().equals(id)).findFirst().orElseThrow(()->new StoreNotFoundException("Runtime subscription was not found")); }
}
