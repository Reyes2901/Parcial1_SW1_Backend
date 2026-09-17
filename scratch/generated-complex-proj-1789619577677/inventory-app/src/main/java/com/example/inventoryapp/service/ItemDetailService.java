package com.example.inventoryapp.service;

import com.example.inventoryapp.dto.ItemDetailDTO;
import com.example.inventoryapp.entity.ItemDetail;
import com.example.inventoryapp.mapper.ItemDetailMapper;
import com.example.inventoryapp.repository.ItemDetailRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class ItemDetailService {

    private final ItemDetailRepository repository;
    private final ItemDetailMapper mapper;

    public ItemDetailService(ItemDetailRepository repository, ItemDetailMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ItemDetailDTO> findAll() {
        return repository.findAll().stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ItemDetailDTO findById(Long id) {
        ItemDetail entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("ItemDetail not found with id: " + id));
        return mapper.toDto(entity);
    }

    public ItemDetailDTO create(ItemDetailDTO dto) {
        ItemDetail entity = mapper.toEntity(dto);
        ItemDetail saved = repository.save(entity);
        return mapper.toDto(saved);
    }

    public ItemDetailDTO update(Long id, ItemDetailDTO dto) {
        ItemDetail existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("ItemDetail not found with id: " + id));
        mapper.updateEntityFromDto(dto, existing);
        ItemDetail saved = repository.save(existing);
        return mapper.toDto(saved);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("ItemDetail not found with id: " + id);
        }
        repository.deleteById(id);
    }
}
