package com.example.inventoryapp.service;

import com.example.inventoryapp.dto.BookDTO;
import com.example.inventoryapp.entity.Book;
import com.example.inventoryapp.mapper.BookMapper;
import com.example.inventoryapp.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class BookService {

    private final BookRepository repository;
    private final BookMapper mapper;

    public BookService(BookRepository repository, BookMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<BookDTO> findAll() {
        return repository.findAll().stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BookDTO findById(UUID id) {
        Book entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Book not found with id: " + id));
        return mapper.toDto(entity);
    }

    public BookDTO create(BookDTO dto) {
        Book entity = mapper.toEntity(dto);
        Book saved = repository.save(entity);
        return mapper.toDto(saved);
    }

    public BookDTO update(UUID id, BookDTO dto) {
        Book existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Book not found with id: " + id));
        mapper.updateEntityFromDto(dto, existing);
        Book saved = repository.save(existing);
        return mapper.toDto(saved);
    }

    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Book not found with id: " + id);
        }
        repository.deleteById(id);
    }
}
