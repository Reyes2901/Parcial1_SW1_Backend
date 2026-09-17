package com.example.inventoryapp.service;

import com.example.inventoryapp.dto.ItemDTO;
import com.example.inventoryapp.entity.Item;
import com.example.inventoryapp.mapper.ItemMapper;
import com.example.inventoryapp.repository.ItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class ItemService {

    private final ItemRepository repository;
    private final ItemMapper mapper;

    public ItemService(ItemRepository repository, ItemMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ItemDTO> findAll() {
        return repository.findAll().stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ItemDTO findById(UUID id) {
        Item entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found with id: " + id));
        return mapper.toDto(entity);
    }

    public ItemDTO create(ItemDTO dto) {
        Item entity = mapper.toEntity(dto);
        Item saved = repository.save(entity);
        return mapper.toDto(saved);
    }

    public ItemDTO update(UUID id, ItemDTO dto) {
        Item existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found with id: " + id));
        mapper.updateEntityFromDto(dto, existing);
        Item saved = repository.save(existing);
        return mapper.toDto(saved);
    }

    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Item not found with id: " + id);
        }
        repository.deleteById(id);
    }
}
